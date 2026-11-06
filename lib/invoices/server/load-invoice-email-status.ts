import type { SupabaseClient } from "@supabase/supabase-js";
import { findOutboundByIdempotencyKey } from "@/lib/outbound/handoff";
import { invoiceIssuedKey } from "@/lib/outbound/keys";

/**
 * Saved invoice-email status for the trader screen.
 * Reads the durable outbound row `invoice_issued/{invoiceId}`.
 * Returns only the status and attempt time. No recipient, token, or email body.
 */
export type InvoiceEmailStatusView = {
  status: string;
  attemptAt: string | null;
};

export async function loadInvoiceEmailStatus(
  supabase: SupabaseClient,
  workspaceId: string,
  invoiceId: string
): Promise<InvoiceEmailStatusView | null> {
  const row = await findOutboundByIdempotencyKey(
    supabase,
    workspaceId,
    invoiceIssuedKey(invoiceId)
  );
  if (!row) return null;
  if (row.workspace_id !== workspaceId) return null;
  if (row.event_kind !== "invoice_issued") return null;
  if (row.invoice_id && row.invoice_id !== invoiceId) return null;
  return {
    status: row.status,
    attemptAt: row.attempt_at,
  };
}
