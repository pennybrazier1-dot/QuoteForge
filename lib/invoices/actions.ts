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

export type InvoiceActionState = {
  error?: string;
  success?: boolean;
  invoice?: InvoiceRecord;
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

  const now = new Date().toISOString();
  const { data: updated, error } = await auth.supabase
    .from("invoices")
    .update({
      ...payload,
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
