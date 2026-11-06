"use server";

import { revalidatePath } from "next/cache";
import {
  ensureInvoiceDraftForJob,
  INVOICE_APPROVED_NOTE,
  INVOICE_SELECT,
  loadInvoiceForProposal,
} from "@/lib/invoices/ensure-draft";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import {
  parseInvoiceLineItems,
  parseInvoiceRow,
} from "@/lib/invoices/parse";
import type { InvoiceLineItem, InvoiceRecord } from "@/lib/invoices/types";
import {
  validateInvoiceDraft,
  withNormalizedPricingStates,
} from "@/lib/invoices/validate-draft";
import { userHasProfile } from "@/lib/onboarding/status";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { createClient } from "@/lib/supabase/server";

import {
  buildInvoiceBusinessSnapshotColumns,
  captureInvoiceLogoSnapshot,
  loadWorkspaceBranding,
} from "@/lib/invoices/business-snapshot";

export type InvoiceActionState = {
  error?: string;
  success?: boolean;
  invoice?: InvoiceRecord;
  emailDelivery?: {
    skipped?: "no_recipient" | "already_terminal" | "not_notifiable";
    status?: string;
    unknownOutcome?: boolean;
    providerAccepted?: boolean;
    simulated?: boolean;
    outboundId?: string;
  };
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function getChecked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
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

function parseLineItemsFromForm(formData: FormData): InvoiceLineItem[] | null {
  const raw = getString(formData, "lineItemsJson");
  if (!raw) {
    return [];
  }
  try {
    return withNormalizedPricingStates(
      parseInvoiceLineItems(JSON.parse(raw))
    );
  } catch {
    return null;
  }
}

function revalidateInvoicePaths(proposalId: string) {
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/proposals/${proposalId}/invoice`);
  revalidatePath("/dashboard");
  revalidatePath("/completed-jobs");
}

type DraftPersistInput = {
  existing: InvoiceRecord;
  lineItems: InvoiceLineItem[];
  vatAmount: number;
  amountPaid: number;
  adjustmentConfirmed: boolean;
  taxConfirmed: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  jobTitle: string;
  jobAddress: string;
  workDescription: string;
  notes: string | null;
};

function buildDraftUpdatePayload(input: DraftPersistInput) {
  const validation = validateInvoiceDraft({
    line_items: input.lineItems,
    vat_amount: input.vatAmount,
    amount_paid: input.amountPaid,
    agreed_total_amount: input.existing.agreed_total_amount,
    source_vat_amount: input.existing.source_vat_amount,
    adjustment_confirmed: input.adjustmentConfirmed,
    tax_confirmed: input.taxConfirmed,
    notes: input.notes,
  });

  return {
    validation,
    payload: {
      customer_name: input.customerName || input.existing.customer_name,
      customer_email: input.customerEmail || input.existing.customer_email,
      customer_phone: input.customerPhone || input.existing.customer_phone,
      customer_address:
        input.customerAddress || input.existing.customer_address,
      job_title: input.jobTitle || input.existing.job_title,
      job_address: input.jobAddress || input.existing.job_address,
      work_description:
        input.workDescription || input.existing.work_description,
      notes: input.notes,
      line_items: input.lineItems,
      flags: validation.flags,
      vat_amount: input.vatAmount,
      subtotal_amount: validation.subtotal_amount,
      total_amount: validation.total_amount,
      amount_paid: input.amountPaid,
      balance_due: validation.balance_due,
      adjustment_confirmed: input.adjustmentConfirmed,
      tax_confirmed: input.taxConfirmed,
    },
  };
}

function readDraftFormFields(
  formData: FormData,
  existing: InvoiceRecord
): DraftPersistInput | { error: string } {
  const lineItems = parseLineItemsFromForm(formData);
  if (lineItems === null) {
    return { error: "Could not read invoice line items." };
  }
  if (lineItems.length === 0) {
    return { error: "Add at least one line item." };
  }

  const vatAmount = Math.max(
    0,
    Math.round(Number(getString(formData, "vatAmountPence") || "0"))
  );
  const amountPaid = Math.max(
    0,
    Math.round(
      Number(
        getString(formData, "amountPaidPence") || String(existing.amount_paid)
      )
    )
  );

  return {
    existing,
    lineItems,
    vatAmount,
    amountPaid,
    adjustmentConfirmed: getChecked(formData, "adjustmentConfirmed"),
    taxConfirmed: getChecked(formData, "taxConfirmed"),
    customerName: getString(formData, "customerName"),
    customerEmail: getString(formData, "customerEmail"),
    customerPhone: getString(formData, "customerPhone"),
    customerAddress: getString(formData, "customerAddress"),
    jobTitle: getString(formData, "jobTitle"),
    jobAddress: getString(formData, "jobAddress"),
    workDescription: getString(formData, "workDescription"),
    notes: getString(formData, "notes") || null,
  };
}

/**
 * Save draft edits. Never sends email. Rejects approved invoices.
 * Persists validation flags but does not require a clean draft to save.
 */
export async function saveInvoiceDraftAction(
  _prev: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }

  const proposalId = getString(formData, "proposalId");
  const invoiceId = getString(formData, "invoiceId");
  if (!proposalId || !invoiceId) {
    return { error: "Invoice not found." };
  }

  const existing = await loadInvoiceForProposal(
    auth.supabase,
    proposalId,
    auth.workspaceId
  );
  if (!existing || existing.id !== invoiceId) {
    return { error: "Invoice not found." };
  }
  if (existing.status !== "draft") {
    return { error: "Only draft invoices can be edited." };
  }

  const fields = readDraftFormFields(formData, existing);
  if ("error" in fields) {
    return { error: fields.error };
  }

  const { payload } = buildDraftUpdatePayload(fields);

  const { data: updated, error } = await auth.supabase
    .from("invoices")
    .update(payload)
    .eq("id", invoiceId)
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "draft")
    .select(INVOICE_SELECT)
    .maybeSingle();

  if (error || !updated) {
    return { error: error?.message ?? "Could not save invoice draft." };
  }

  revalidateInvoicePaths(proposalId);
  return {
    success: true,
    invoice: parseInvoiceRow(updated as Record<string, unknown>),
  };
}

/**
 * Persist current form snapshot then approve.
 * Never sends email. Never marks paid. Never creates a payment transaction.
 */
export async function approveInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }

  const proposalId = getString(formData, "proposalId");
  const invoiceId = getString(formData, "invoiceId");
  if (!proposalId || !invoiceId) {
    return { error: "Invoice not found." };
  }

  const existing = await loadInvoiceForProposal(
    auth.supabase,
    proposalId,
    auth.workspaceId
  );
  if (!existing || existing.id !== invoiceId) {
    return { error: "Invoice not found." };
  }
  if (existing.status === "approved") {
    // Idempotent: already approved — do not rewrite or email.
    return { success: true, invoice: existing };
  }
  if (existing.status !== "draft") {
    return { error: "Only draft invoices can be approved." };
  }

  const fields = readDraftFormFields(formData, existing);
  if ("error" in fields) {
    return { error: fields.error };
  }

  const { validation, payload } = buildDraftUpdatePayload(fields);
  if (!validation.canApprove) {
    return { error: validation.errors[0] ?? "Resolve pricing issues before approving." };
  }

  const branding = await loadWorkspaceBranding(
    auth.supabase,
    auth.workspaceId
  );
  if (!branding) {
    return { error: "Could not load your business details to freeze on this invoice." };
  }
  const logoCapture = await captureInvoiceLogoSnapshot(
    auth.supabase,
    auth.workspaceId,
    invoiceId
  );
  if (!logoCapture.ok) {
    return { error: logoCapture.error };
  }

  const now = new Date().toISOString();
  const snapshot = buildInvoiceBusinessSnapshotColumns({
    workspace: branding,
    logoPath: logoCapture.path,
    capturedAtIso: now,
  });
  const { data: updated, error } = await auth.supabase
    .from("invoices")
    .update({
      ...payload,
      ...snapshot,
      status: "approved",
      approved_at: now,
      approved_by: auth.user.id,
    })
    .eq("id", invoiceId)
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "draft")
    .select(INVOICE_SELECT)
    .maybeSingle();

  if (error || !updated) {
    // Concurrent approve: treat already-approved as success.
    const raced = await loadInvoiceForProposal(
      auth.supabase,
      proposalId,
      auth.workspaceId
    );
    if (raced?.status === "approved" && raced.id === invoiceId) {
      return { success: true, invoice: raced };
    }
    return { error: error?.message ?? "Could not approve invoice." };
  }

  await recordProposalEvent(auth.supabase, {
    workspaceId: auth.workspaceId,
    proposalId,
    userId: auth.user.id,
    eventType: "status_change",
    fromStatus: "completed",
    toStatus: "completed",
    note: INVOICE_APPROVED_NOTE,
    metadata: {
      action: "invoice_approved",
      invoice_id: invoiceId,
      invoice_number: existing.invoice_number,
      // Stage 1/1B: approval does not send email and does not request payment.
      email_sent: false,
      payment_requested: false,
      marked_paid: false,
    },
  });

  revalidateInvoicePaths(proposalId);
  return {
    success: true,
    invoice: parseInvoiceRow(updated as Record<string, unknown>),
  };
}

/**
 * Email an approved invoice when the trader presses the button.
 * Approval does not call this. The form cannot choose a different recipient.
 * Does not record a payment, close the job, or change invoice totals.
 */
export async function sendInvoiceEmailAction(
  _prev: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const auth = await requireTrader();
  if (!auth.ok) {
    return { error: auth.error };
  }

  const proposalId = getString(formData, "proposalId");
  const invoiceId = getString(formData, "invoiceId");
  if (!proposalId || !invoiceId) {
    return { error: "Invoice not found." };
  }

  const existing = await loadInvoiceForProposal(
    auth.supabase,
    proposalId,
    auth.workspaceId
  );
  if (!existing || existing.id !== invoiceId) {
    return { error: "Invoice not found." };
  }
  if (existing.status !== "approved") {
    return { error: "Approve the invoice before emailing the customer." };
  }

  const snapshot = {
    total_amount: existing.total_amount,
    vat_amount: existing.vat_amount,
    subtotal_amount: existing.subtotal_amount,
    amount_paid: existing.amount_paid,
    balance_due: existing.balance_due,
    business_name: existing.business_name,
    business_snapshot_at: existing.business_snapshot_at,
  };

  const { notifyCustomerOfInvoiceIssued } = await import(
    "@/lib/invoices/server/notify-invoice-issued"
  );
  const result = await notifyCustomerOfInvoiceIssued(
    auth.supabase,
    invoiceId,
    auth.workspaceId
  );

  const after = await loadInvoiceForProposal(
    auth.supabase,
    proposalId,
    auth.workspaceId
  );
  if (
    !after ||
    after.total_amount !== snapshot.total_amount ||
    after.vat_amount !== snapshot.vat_amount ||
    after.subtotal_amount !== snapshot.subtotal_amount ||
    after.amount_paid !== snapshot.amount_paid ||
    after.balance_due !== snapshot.balance_due ||
    after.business_name !== snapshot.business_name ||
    after.business_snapshot_at !== snapshot.business_snapshot_at
  ) {
    return {
      error: "Invoice amounts changed unexpectedly. Email was not confirmed.",
      invoice: after ?? existing,
    };
  }

  if (result.ok && result.skipped === "already_terminal") {
    revalidateInvoicePaths(proposalId);
    return {
      success: true,
      invoice: after,
      emailDelivery: {
        skipped: "already_terminal",
        status: "provider_accepted",
      },
    };
  }

  if (result.ok && result.skipped) {
    return {
      success: false,
      error: result.reason,
      invoice: after,
      emailDelivery: { skipped: result.skipped },
    };
  }

  if (!result.ok) {
    return {
      error: result.error || "Could not email the invoice.",
      invoice: after,
    };
  }

  const delivery = result.delivery;
  revalidateInvoicePaths(proposalId);

  if (delivery.unknownOutcome) {
    return {
      success: false,
      error:
        delivery.error ||
        "Email outcome is unknown. Do not resend until you confirm with the provider.",
      invoice: after,
      emailDelivery: {
        status: delivery.status,
        unknownOutcome: true,
        outboundId: result.outboundId,
      },
    };
  }

  if (!delivery.ok) {
    return {
      success: false,
      error: delivery.error || "Invoice email could not be sent.",
      invoice: after,
      emailDelivery: {
        status: delivery.status,
        outboundId: result.outboundId,
      },
    };
  }

  await recordProposalEvent(auth.supabase, {
    workspaceId: auth.workspaceId,
    proposalId,
    userId: auth.user.id,
    eventType: "status_change",
    fromStatus: "completed",
    toStatus: "completed",
    note: delivery.simulated
      ? "Invoice email simulated locally"
      : "Invoice email accepted by the provider",
    metadata: {
      action: "invoice_emailed",
      invoice_id: invoiceId,
      invoice_number: existing.invoice_number,
      outbound_id: result.outboundId,
      email_status: delivery.status ?? null,
      marked_paid: false,
    },
  });

  return {
    success: true,
    invoice: after,
    emailDelivery: {
      status: delivery.status,
      providerAccepted: delivery.providerAccepted,
      simulated: delivery.simulated,
      outboundId: result.outboundId,
    },
  };
}

/**
 * Retry creating a missing invoice draft for an already-completed job.
 * Idempotent: reuses the existing row when one already exists.
 * Never emails. Never changes payment_status.
 */
export async function retryPrepareInvoiceDraftAction(
  _prev: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
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
    .select("id, status, workspace_id, payment_status")
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Job not found." };
  }

  const status = normalizeProposalStatus(proposal.status);
  if (
    status !== "completed" &&
    status !== "closed" &&
    status !== "invoiced" &&
    status !== "paid"
  ) {
    return { error: "Only completed jobs can prepare an invoice." };
  }

  // Snapshot payment status — recovery must leave it untouched.
  const paymentBefore = proposal.payment_status ?? "not_requested";

  const ensured = await ensureInvoiceDraftForJob(auth.supabase, {
    proposalId: proposal.id,
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
  });

  if (!ensured.ok) {
    return {
      error: ensured.error || "Could not prepare invoice. Please retry.",
    };
  }

  const { data: paymentCheck } = await auth.supabase
    .from("proposals")
    .select("payment_status")
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (
    paymentCheck &&
    (paymentCheck.payment_status ?? "not_requested") !== paymentBefore
  ) {
    // Defensive: never leave a mutated payment status from invoice recovery.
    await auth.supabase
      .from("proposals")
      .update({ payment_status: paymentBefore })
      .eq("id", proposalId)
      .eq("workspace_id", auth.workspaceId);
  }

  revalidateInvoicePaths(proposalId);
  return { success: true, invoice: ensured.invoice };
}
