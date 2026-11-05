"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import { buildPaymentRequestedEmail } from "@/lib/payments/email";
import { ensurePaidInvoiceAndJob } from "@/lib/payments/ensure-paid-lifecycle";
import { parseRecordInvoicePaymentRpcResult } from "@/lib/payments/invoice-payment-ledger";
import {
  buildIssuedBankSnapshot,
  buildIssuedPaymentUrl,
  canCloseJob,
  canMarkPaymentPaid,
  canRecordInvoicePayment,
  canRequestPayment,
  canWaivePayment,
  closedTimelineNote,
  defaultPaymentDueAmount,
  enabledPaymentMethods,
  paidTimelineNote,
  paymentRequestTimelineNote,
  poundsInputToPence,
} from "@/lib/payments/job-payment";
import {
  emptyPaymentSettings,
  preparePaymentSettingsWrite,
} from "@/lib/payments/settings";
import {
  isPaymentMethod,
  type PaymentMethod,
  type WorkspacePaymentSettings,
} from "@/lib/payments/types";
import { randomUUID } from "node:crypto";
import { ensureProposalCustomerAccessToken } from "@/lib/proposals/customer-portal/ensure-token";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import { loadWorkspaceEmailLogoUrl } from "@/lib/proposals/pdf/customer-branding";
import { COMPLETED_JOBS_PATH } from "@/lib/jobs/complete-job";

export type PaymentActionState = {
  error?: string;
  success?: boolean;
  warning?: string;
};

const CLOSED_JOBS_PATH = "/closed-jobs";

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function getBoolean(formData: FormData, key: string): boolean {
  const value = String(formData.get(key) ?? "");
  return value === "on" || value === "true" || value === "1";
}

async function requireTrader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "You must be signed in." };
  }
  if (!(await userHasProfile(user.id))) {
    return { ok: false as const, error: "Please complete onboarding first." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return { ok: false as const, error: "Workspace not found." };
  }
  return {
    ok: true as const,
    supabase,
    user,
    workspaceId: profile.workspace_id as string,
  };
}

function revalidatePaymentPaths(proposalId: string, token?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(COMPLETED_JOBS_PATH);
  revalidatePath(CLOSED_JOBS_PATH);
  revalidatePath("/customers");
  revalidatePath("/settings");
  if (token) {
    revalidatePath(`/p/${token}`);
  }
}

export async function loadWorkspacePaymentSettings(): Promise<WorkspacePaymentSettings | null> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return null;
  }
  const { data } = await auth.supabase
    .from("workspace_payment_settings")
    .select(
      "workspace_id, accept_bank_transfer, accept_card_link, accept_card_in_person, accept_cash, accept_other, bank_account_name, bank_sort_code, bank_account_number, bank_reference_instructions, external_payment_url, other_method_label"
    )
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  return data
    ? (data as WorkspacePaymentSettings)
    : emptyPaymentSettings(auth.workspaceId);
}

export async function savePaymentSettingsAction(
  _prev: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }

  const prepared = preparePaymentSettingsWrite(auth.workspaceId, {
    accept_bank_transfer: getBoolean(formData, "accept_bank_transfer"),
    accept_card_link: getBoolean(formData, "accept_card_link"),
    accept_card_in_person: getBoolean(formData, "accept_card_in_person"),
    accept_cash: getBoolean(formData, "accept_cash"),
    accept_other: getBoolean(formData, "accept_other"),
    bank_account_name: getString(formData, "bank_account_name"),
    bank_sort_code: getString(formData, "bank_sort_code"),
    bank_account_number: getString(formData, "bank_account_number"),
    bank_reference_instructions: getString(formData, "bank_reference_instructions"),
    external_payment_url: getString(formData, "external_payment_url"),
    other_method_label: getString(formData, "other_method_label"),
  });

  if (!prepared.ok) {
    return { error: prepared.error };
  }

  const { error } = await auth.supabase
    .from("workspace_payment_settings")
    .upsert(prepared.row, { onConflict: "workspace_id" });

  if (error) {
    return { error: "Couldn't save payment settings. Please try again." };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function requestJobPaymentAction(
  _prev: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }

  const proposalId = getString(formData, "proposalId");
  if (!proposalId) {
    return { error: "Job not found." };
  }

  const { data: proposal, error: loadError } = await auth.supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, title, customer_name, customer_email, total_amount, payment_status, closed_at, customer_access_token"
    )
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Job not found." };
  }

  if (
    !canRequestPayment({
      jobStatus: proposal.status,
      paymentStatus: proposal.payment_status,
      closedAt: proposal.closed_at,
    })
  ) {
    return { error: "Payment can only be requested on a completed job." };
  }

  const settings = (await loadWorkspacePaymentSettings()) ??
    emptyPaymentSettings(auth.workspaceId);
  const enabled = enabledPaymentMethods(settings);
  const selected = formData
    .getAll("methods")
    .map((value) => String(value))
    .filter(isPaymentMethod)
    .filter((method) => enabled.includes(method));

  if (selected.length === 0) {
    return {
      error:
        enabled.length === 0
          ? "Add a payment method in Settings → Payments first."
          : "Choose at least one payment method.",
    };
  }

  const amountPounds = Number(getString(formData, "amountPounds"));
  const amountPence = Number.isFinite(amountPounds)
    ? Math.round(amountPounds * 100)
    : defaultPaymentDueAmount(proposal.total_amount);
  if (amountPence <= 0) {
    return { error: "Enter the amount due." };
  }

  const bank = buildIssuedBankSnapshot(settings, selected);
  if (selected.includes("bank_transfer") && !bank) {
    return { error: "Add bank details in Settings before requesting a transfer." };
  }
  const cardUrl = buildIssuedPaymentUrl(settings, selected);
  if (selected.includes("card_link") && !cardUrl) {
    return { error: "Add a card payment link in Settings first." };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await auth.supabase
    .from("proposals")
    .update({
      payment_status: "requested",
      payment_requested_at: now,
      payment_due_amount: amountPence,
      payment_methods_issued: selected,
      issued_bank_account_name: bank?.accountName ?? null,
      issued_bank_sort_code: bank?.sortCode ?? null,
      issued_bank_account_number: bank?.accountNumber ?? null,
      issued_bank_reference: bank?.reference ?? null,
      issued_payment_url: cardUrl,
    })
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .select("id, payment_status")
    .maybeSingle();

  if (updateError || updated?.payment_status !== "requested") {
    return { error: "Couldn't send this payment request. Please try again." };
  }

  await recordProposalEvent(auth.supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: auth.user.id,
    eventType: "status_change",
    fromStatus: normalizeProposalStatus(proposal.status),
    toStatus: normalizeProposalStatus(proposal.status),
    note: paymentRequestTimelineNote(selected),
  });

  const tokenResult = await ensureProposalCustomerAccessToken(
    auth.supabase,
    proposal.id
  );
  let warning: string | undefined;
  if (proposal.customer_email && tokenResult.ok) {
    const { data: workspace } = await auth.supabase
      .from("workspaces")
      .select("business_name, trade_type")
      .eq("id", auth.workspaceId)
      .maybeSingle();
    const email = buildPaymentRequestedEmail({
      businessName: workspace?.business_name ?? "Reanvil",
      customerName: proposal.customer_name,
      jobTitle: proposal.title?.trim() || "your job",
      amountLabel: formatPenceAsGbp(amountPence),
      methods: selected,
      portalToken: tokenResult.token,
      logoUrl: loadWorkspaceEmailLogoUrl({}),
      tradeLabel: workspace?.trade_type,
    });
    const sent = await sendNotificationEmail({
      to: proposal.customer_email,
      subject: email.subject,
      message: email.text,
      businessName: email.businessName,
      html: email.html,
      content: undefined,
      ctaUrl: email.ctaUrl,
      ctaLabel: email.ctaLabel,
    });
    if (!sent.ok) {
      warning = "Payment request saved. The email could not be sent.";
    }
  } else if (!proposal.customer_email) {
    warning = "Payment request saved. This customer has no email address.";
  }

  revalidatePaymentPaths(proposal.id, tokenResult.ok ? tokenResult.token : null);
  return { success: true, warning };
}

export async function recordInvoicePaymentAction(
  _prev: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }

  const proposalId = getString(formData, "proposalId");
  const invoiceId = getString(formData, "invoiceId");
  const amountPence = poundsInputToPence(getString(formData, "amountPounds"));
  const methodRaw = getString(formData, "method");
  const paidOn = getString(formData, "paidOn");
  const reference = getString(formData, "reference");
  const note = getString(formData, "note");
  const idempotencyKey =
    getString(formData, "idempotencyKey") ||
    `manual/${invoiceId}/${randomUUID()}`;

  if (!proposalId || !invoiceId) {
    return { error: "Invoice not found." };
  }
  if (amountPence == null) {
    return { error: "Enter a valid payment amount." };
  }
  if (!isPaymentMethod(methodRaw)) {
    return { error: "Choose a payment method." };
  }
  const method: PaymentMethod = methodRaw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return { error: "Enter the date the payment was received." };
  }

  const { data: proposal } = await auth.supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, payment_status, closed_at, customer_access_token"
    )
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (!proposal) {
    return { error: "Job not found." };
  }

  const { data: invoice } = await auth.supabase
    .from("invoices")
    .select("id, status, balance_due, proposal_id")
    .eq("id", invoiceId)
    .eq("workspace_id", auth.workspaceId)
    .eq("proposal_id", proposalId)
    .eq("status", "approved")
    .maybeSingle();

  if (!invoice) {
    const byId = await auth.supabase
      .from("invoices")
      .select("status")
      .eq("id", invoiceId)
      .eq("workspace_id", auth.workspaceId)
      .eq("proposal_id", proposalId)
      .maybeSingle();
    if (byId.data?.status === "void") {
      return { error: "A void invoice cannot accept payment." };
    }
    return { error: "Only an approved invoice can record payment." };
  }

  const balanceDue = Math.max(0, Math.round(Number(invoice.balance_due ?? 0)));
  const canRecord = canRecordInvoicePayment({
    jobStatus: proposal.status,
    paymentStatus: proposal.payment_status,
    closedAt: proposal.closed_at,
    balanceDuePence: balanceDue,
    hasApprovedInvoice: true,
  });

  if (canRecord && amountPence > balanceDue) {
    return {
      error: `Payment cannot be more than the outstanding balance (${(balanceDue / 100).toFixed(2)}).`,
    };
  }

  const { data: rpcData, error: rpcError } = await auth.supabase.rpc(
    "record_invoice_payment",
    {
      p_invoice_id: invoice.id,
      p_amount_pence: amountPence,
      p_method: method,
      p_paid_on: paidOn,
      p_reference: reference || null,
      p_note: note || null,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (rpcError) {
    const message = rpcError.message ?? "";
    if (/exceed balance|already fully paid/i.test(message)) {
      if (!canRecord) {
        return { error: "This invoice cannot accept another payment." };
      }
      return {
        error:
          "That payment could not be recorded because it would exceed the outstanding balance.",
      };
    }
    return { error: "Couldn't record this payment. Please try again." };
  }

  const parsed = parseRecordInvoicePaymentRpcResult(rpcData);
  if (!parsed) {
    return { error: "Couldn't record this payment. Please try again." };
  }

  if (!parsed.already_recorded) {
    await recordProposalEvent(auth.supabase, {
      workspaceId: proposal.workspace_id,
      proposalId: proposal.id,
      userId: auth.user.id,
      eventType: "status_change",
      fromStatus: normalizeProposalStatus(proposal.status),
      toStatus: normalizeProposalStatus(proposal.status),
      note: parsed.fully_settled
        ? paidTimelineNote()
        : `Payment recorded (${(amountPence / 100).toFixed(2)})`,
    });
  }

  // Thin Lifecycle: no outbound payment notification in this batch.
  revalidatePaymentPaths(proposal.id, proposal.customer_access_token);
  return {
    success: true,
    warning: parsed.already_recorded
      ? "This payment was already recorded."
      : undefined,
  };
}

export async function markJobPaidAction(
  _prev: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }

  const proposalId = getString(formData, "proposalId");
  const { data: proposal } = await auth.supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, title, customer_name, customer_email, payment_status, payment_due_amount, payment_methods_issued, closed_at, customer_access_token"
    )
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (!proposal) {
    return { error: "Job not found." };
  }

  // Idempotent heal when already paid — never invent a second ledger row.
  if (proposal.payment_status === "paid" && !proposal.closed_at) {
    const heal = await ensurePaidInvoiceAndJob({
      supabase: auth.supabase,
      workspaceId: auth.workspaceId,
      proposalId: proposal.id,
      paymentMethodsIssued: proposal.payment_methods_issued,
    });
    revalidatePaymentPaths(proposal.id, proposal.customer_access_token);
    return { success: true, warning: heal.warning };
  }

  if (
    !canMarkPaymentPaid({
      jobStatus: proposal.status,
      paymentStatus: proposal.payment_status,
      closedAt: proposal.closed_at,
    })
  ) {
    return {
      error:
        "Only a requested or partially paid balance can be marked as paid.",
    };
  }

  // Ledger RPC records remaining balance; updates proposal + job. Paid ≠ Closed.
  // Thin Lifecycle: no outbound notification / email in this batch.
  const lifecycle = await ensurePaidInvoiceAndJob({
    supabase: auth.supabase,
    workspaceId: auth.workspaceId,
    proposalId: proposal.id,
    paymentMethodsIssued: proposal.payment_methods_issued,
  });

  if (lifecycle.error) {
    return { error: lifecycle.error };
  }
  if (!lifecycle.invoiceSettled && lifecycle.invoiceAlreadySettled === false) {
    const { data: after } = await auth.supabase
      .from("proposals")
      .select("payment_status, paid_at, customer_access_token")
      .eq("id", proposal.id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (after?.payment_status !== "paid") {
      return { error: "Couldn't mark this payment as paid. Please try again." };
    }
  }

  if (lifecycle.paymentRecorded || !lifecycle.invoiceAlreadySettled) {
    await recordProposalEvent(auth.supabase, {
      workspaceId: proposal.workspace_id,
      proposalId: proposal.id,
      userId: auth.user.id,
      eventType: "status_change",
      fromStatus: normalizeProposalStatus(proposal.status),
      toStatus: normalizeProposalStatus(proposal.status),
      note: paidTimelineNote(),
    });
  }

  revalidatePaymentPaths(proposal.id, proposal.customer_access_token);
  return { success: true, warning: lifecycle.warning };
}

export async function waiveJobPaymentAction(
  _prev: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }
  const proposalId = getString(formData, "proposalId");
  const { data: proposal } = await auth.supabase
    .from("proposals")
    .select("id, status, workspace_id, payment_status, closed_at")
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (!proposal) {
    return { error: "Job not found." };
  }
  if (
    !canWaivePayment({
      jobStatus: proposal.status,
      paymentStatus: proposal.payment_status,
      closedAt: proposal.closed_at,
    })
  ) {
    return { error: "This payment cannot be marked as not required." };
  }

  const { error } = await auth.supabase
    .from("proposals")
    .update({
      payment_status: "waived",
      payment_due_amount: 0,
    })
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return { error: "Couldn't update payment. Please try again." };
  }

  await recordProposalEvent(auth.supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: auth.user.id,
    eventType: "status_change",
    fromStatus: normalizeProposalStatus(proposal.status),
    toStatus: normalizeProposalStatus(proposal.status),
    note: "Payment not required",
  });

  revalidatePaymentPaths(proposal.id);
  return { success: true };
}

export async function closeJobAction(
  _prev: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }
  const proposalId = getString(formData, "proposalId");
  const { data: proposal } = await auth.supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, payment_status, closed_at, customer_access_token"
    )
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (!proposal) {
    return { error: "Job not found." };
  }
  if (
    !canCloseJob({
      jobStatus: proposal.status,
      paymentStatus: proposal.payment_status,
      closedAt: proposal.closed_at,
    })
  ) {
    return {
      error:
        "This job cannot be closed until payment is received or marked as not required.",
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await auth.supabase
    .from("proposals")
    .update({
      status: "closed",
      closed_at: now,
    })
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .select("id, status, closed_at")
    .maybeSingle();

  if (error || updated?.status !== "closed" || !updated.closed_at) {
    return { error: "Couldn't close this job. Please try again." };
  }

  await recordProposalEvent(auth.supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: auth.user.id,
    eventType: "status_change",
    fromStatus: normalizeProposalStatus(proposal.status),
    toStatus: "closed",
    note: closedTimelineNote(),
  });

  revalidatePaymentPaths(proposal.id, proposal.customer_access_token);
  return { success: true };
}
