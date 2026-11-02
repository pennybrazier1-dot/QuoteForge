import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoiceDraftFromProposal } from "@/lib/invoices/build-draft-from-proposal";
import {
  categorizeInvoiceFailure,
  logInvoiceDraftFailure,
} from "@/lib/invoices/failure-log";
import { parseInvoiceRow } from "@/lib/invoices/parse";
import type { InvoiceRecord } from "@/lib/invoices/types";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";

function failEnsure(
  input: { proposalId: string; workspaceId: string },
  error: string
): { ok: false; error: string } {
  logInvoiceDraftFailure({
    proposalId: input.proposalId,
    workspaceId: input.workspaceId,
    category: categorizeInvoiceFailure(error),
    message: error,
  });
  return { ok: false, error };
}

export const INVOICE_DRAFT_CREATED_NOTE = "Invoice draft created";
export const INVOICE_APPROVED_NOTE = "Invoice approved";

const PROPOSAL_INVOICE_SELECT =
  "id, workspace_id, customer_id, title, job_summary, scope_of_work, materials, labour_description, ai_optional_extras, job_address, customer_name, customer_email, customer_phone, customer_address, subtotal_amount, vat_amount, total_amount, currency, payment_status, payment_due_amount";

const INVOICE_SELECT =
  "id, workspace_id, proposal_id, customer_id, job_id, invoice_number, status, currency, business_name, customer_name, customer_email, customer_phone, customer_address, job_title, job_address, work_description, line_items, flags, notes, subtotal_amount, vat_amount, total_amount, amount_paid, balance_due, agreed_total_amount, source_vat_amount, adjustment_confirmed, tax_confirmed, created_by, approved_by, created_at, updated_at, approved_at";

export type EnsureInvoiceDraftResult =
  | { ok: true; invoice: InvoiceRecord; created: boolean }
  | { ok: false; error: string };

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "23505" ||
    /duplicate key|unique constraint/i.test(error.message ?? "")
  );
}

export async function loadInvoiceForProposal(
  supabase: SupabaseClient,
  proposalId: string,
  workspaceId: string
): Promise<InvoiceRecord | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("proposal_id", proposalId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return parseInvoiceRow(data as Record<string, unknown>);
}

/**
 * Ensure exactly one invoice exists for a completed job.
 * Retries / concurrent completes reuse the existing row via unique(proposal_id).
 * Does not recycle invoice numbers when a concurrent insert loses the race.
 */
export async function ensureInvoiceDraftForJob(
  supabase: SupabaseClient,
  input: {
    proposalId: string;
    workspaceId: string;
    userId: string;
  }
): Promise<EnsureInvoiceDraftResult> {
  const existing = await loadInvoiceForProposal(
    supabase,
    input.proposalId,
    input.workspaceId
  );
  if (existing) {
    return { ok: true, invoice: existing, created: false };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(PROPOSAL_INVOICE_SELECT)
    .eq("id", input.proposalId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (loadError || !proposal) {
    return failEnsure(input, loadError?.message ?? "Proposal not found.");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("business_name")
    .eq("id", input.workspaceId)
    .maybeSingle();

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("proposal_id", input.proposalId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "allocate_invoice_number",
    { target_workspace_id: input.workspaceId }
  );

  if (numberError || typeof invoiceNumber !== "string" || !invoiceNumber) {
    return failEnsure(
      input,
      numberError?.message ?? "Could not allocate invoice number."
    );
  }

  const draft = buildInvoiceDraftFromProposal(proposal);

  const insertPayload = {
    workspace_id: input.workspaceId,
    proposal_id: input.proposalId,
    customer_id: proposal.customer_id ?? null,
    job_id: job?.id ?? null,
    invoice_number: invoiceNumber,
    status: "draft",
    currency: draft.currency,
    business_name: workspace?.business_name ?? null,
    customer_name: proposal.customer_name ?? null,
    customer_email: proposal.customer_email ?? null,
    customer_phone: proposal.customer_phone ?? null,
    customer_address: proposal.customer_address ?? null,
    job_title: draft.job_title,
    job_address: proposal.job_address ?? null,
    work_description: draft.work_description,
    line_items: draft.line_items,
    flags: draft.flags,
    notes: null,
    subtotal_amount: draft.subtotal_amount,
    vat_amount: draft.vat_amount,
    total_amount: draft.total_amount,
    amount_paid: draft.amount_paid,
    balance_due: draft.balance_due,
    agreed_total_amount: draft.agreed_total_amount,
    source_vat_amount: draft.source_vat_amount,
    adjustment_confirmed: false,
    tax_confirmed: false,
    created_by: input.userId,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert(insertPayload)
    .select(INVOICE_SELECT)
    .maybeSingle();

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      const raced = await loadInvoiceForProposal(
        supabase,
        input.proposalId,
        input.workspaceId
      );
      if (raced) {
        // Number may have been allocated unused — do not recycle it.
        return { ok: true, invoice: raced, created: false };
      }
      return failEnsure(
        input,
        insertError.message ?? "Could not create invoice draft."
      );
    }
    return failEnsure(
      input,
      insertError.message ?? "Could not create invoice draft."
    );
  }

  if (!inserted) {
    return failEnsure(input, "Could not create invoice draft.");
  }

  await recordProposalEvent(supabase, {
    workspaceId: input.workspaceId,
    proposalId: input.proposalId,
    userId: input.userId,
    eventType: "status_change",
    fromStatus: "completed",
    toStatus: "completed",
    note: INVOICE_DRAFT_CREATED_NOTE,
    metadata: {
      action: "invoice_draft_created",
      invoice_id: inserted.id,
      invoice_number: inserted.invoice_number,
    },
  });

  return {
    ok: true,
    invoice: parseInvoiceRow(inserted as Record<string, unknown>),
    created: true,
  };
}

/**
 * Stage 1B: reopen must preserve draft invoice identity and number.
 * Only approved invoices block reopen (credit notes come later).
 */
export async function assertInvoiceAllowsReopen(
  supabase: SupabaseClient,
  input: { proposalId: string; workspaceId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await loadInvoiceForProposal(
    supabase,
    input.proposalId,
    input.workspaceId
  );
  if (!existing) {
    return { ok: true };
  }
  if (existing.status === "approved") {
    return {
      ok: false,
      error:
        "This job has an approved invoice. It cannot be reopened without a correction process.",
    };
  }
  // Draft (and void) rows are kept so a later complete reuses the same invoice.
  return { ok: true };
}

/** @deprecated Use assertInvoiceAllowsReopen — drafts are preserved on reopen. */
export async function deleteDraftInvoiceForProposal(
  supabase: SupabaseClient,
  input: { proposalId: string; workspaceId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  return assertInvoiceAllowsReopen(supabase, input);
}

export { INVOICE_SELECT };
