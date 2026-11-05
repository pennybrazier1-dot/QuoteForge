/**
 * Thin Lifecycle — current invoice selection (B3-schema safe).
 *
 * At most one invoice per proposal with status in ('draft', 'approved').
 * Historical void invoices are never the collectible current invoice.
 * Does not SELECT waiver / credit-note / cancel-replace columns.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseInvoiceRow } from "@/lib/invoices/parse";
import type { InvoiceRecord, InvoiceStatus } from "@/lib/invoices/types";

export const INVOICE_SELECT =
  "id, workspace_id, proposal_id, customer_id, job_id, invoice_number, status, currency, business_name, issued_address_line_1, issued_address_line_2, issued_town, issued_county, issued_postcode, issued_phone, issued_email, issued_vat_number, issued_website, issued_company_number, issued_logo_path, business_snapshot_at, customer_name, customer_email, customer_phone, customer_address, job_title, job_address, work_description, line_items, flags, notes, subtotal_amount, vat_amount, total_amount, amount_paid, balance_due, agreed_total_amount, source_vat_amount, adjustment_confirmed, tax_confirmed, created_by, approved_by, created_at, updated_at, approved_at, opening_amount_paid";

export const CURRENT_INVOICE_STATUSES = ["draft", "approved"] as const;
export type CurrentInvoiceStatus = (typeof CURRENT_INVOICE_STATUSES)[number];

/** Void status = historical / non-current (supported on committed invoice schema). */
export const CANCELLED_INVOICE_STATUS = "void" as const;

export const INVOICE_CANCELLED_PENDING_REPLACEMENT_COPY =
  "Previous invoice is void. An updated invoice has not yet been issued.";

export function isCurrentInvoiceStatus(
  status: string | null | undefined
): status is CurrentInvoiceStatus {
  return status === "draft" || status === "approved";
}

export function isCancelledInvoiceStatus(
  status: string | null | undefined
): boolean {
  return status === CANCELLED_INVOICE_STATUS;
}

export async function loadCurrentInvoiceForProposal(
  supabase: SupabaseClient,
  proposalId: string,
  workspaceId: string
): Promise<InvoiceRecord | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("proposal_id", proposalId)
    .eq("workspace_id", workspaceId)
    .in("status", [...CURRENT_INVOICE_STATUSES])
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return parseInvoiceRow(data as Record<string, unknown>);
}

export async function loadCurrentApprovedInvoiceForProposal(
  supabase: SupabaseClient,
  proposalId: string,
  workspaceId: string,
  select: string = INVOICE_SELECT
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(select)
    .eq("proposal_id", proposalId)
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as unknown as Record<string, unknown>;
}

export async function loadInvoiceByIdForWorkspace(
  supabase: SupabaseClient,
  invoiceId: string,
  workspaceId: string
): Promise<InvoiceRecord | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return parseInvoiceRow(data as Record<string, unknown>);
}

export type ProposalInvoicePresence = {
  current: InvoiceRecord | null;
  hasCancelledHistory: boolean;
  /** Void history exists and there is no current approved invoice yet. */
  cancelledPendingReplacement: boolean;
};

export async function loadProposalInvoicePresence(
  supabase: SupabaseClient,
  proposalId: string,
  workspaceId: string
): Promise<ProposalInvoicePresence> {
  const current = await loadCurrentInvoiceForProposal(
    supabase,
    proposalId,
    workspaceId
  );

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposalId)
    .eq("workspace_id", workspaceId)
    .eq("status", CANCELLED_INVOICE_STATUS);

  const hasCancelledHistory = (count ?? 0) > 0;
  const cancelledPendingReplacement =
    hasCancelledHistory &&
    (current == null || current.status !== "approved");

  return {
    current,
    hasCancelledHistory,
    cancelledPendingReplacement,
  };
}

export function assertInvoiceIsCurrentApproved(
  status: InvoiceStatus | string | null | undefined
): status is "approved" {
  return status === "approved";
}
