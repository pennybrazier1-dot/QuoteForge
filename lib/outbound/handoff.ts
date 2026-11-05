import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutboundMessageRow, OutboundStatus } from "@/lib/outbound/types";

/**
 * Durable business-event → notification handoff (Stage 9G.1)
 * ===========================================================
 *
 * Contract for later stages (9G.2+):
 *
 * 1. Commit the business write first (enquiry, accept, payment, visit, …).
 * 2. Call `enqueueOutboundMessage` with a stable `idempotency_key`.
 *    The unique (workspace_id, idempotency_key) constraint makes this
 *    crash-safe to retry — a second enqueue returns the existing row.
 * 3. Call `deliverOutboundMessage` (claim → provider → settle).
 *    Failures are recorded on the row; the business action stays successful.
 *
 * Detecting a missing notification after a crash / partial failure
 * ----------------------------------------------------------------
 * - Expected key for the business event is known (see `lib/outbound/keys.ts`).
 * - `findOutboundByIdempotencyKey(workspaceId, key)` returns null → missing.
 * - Recovery: enqueue again (idempotent) then deliver / show recovery UI.
 *
 * Interrupted send (`status = sending`)
 * -------------------------------------
 * - Claim CAS moved the row to `sending` then the process died.
 * - `reconcileStaleOutboundSending` moves old `sending` rows to `unknown`.
 * - Unknown never blind-resends: trader confirms provider message id only.
 *
 * Concurrent duplicate prevention
 * -------------------------------
 * - Unique idempotency key + CAS claim (needed|failed → sending).
 * - Resend `idempotencyKey` (24h) as a second line of defence.
 */

export const RECOVERABLE_OUTBOUND_STATUSES: readonly OutboundStatus[] = [
  "needed",
  "failed",
  "unknown",
  "sending",
] as const;

export function isRecoverableOutboundStatus(
  status: string | null | undefined
): boolean {
  return RECOVERABLE_OUTBOUND_STATUSES.includes(status as OutboundStatus);
}

export function isMissingOutboundRecord(
  row: { id?: string } | null | undefined
): boolean {
  return !row?.id;
}

const OUTBOUND_SELECT =
  "id, workspace_id, event_kind, audience, source_type, source_id, proposal_id, enquiry_id, visit_id, invoice_id, recipient_email, subject, status, provider, provider_message_id, attempt_at, attempt_count, last_error, idempotency_key, metadata, created_at, updated_at";

export async function findOutboundByIdempotencyKey(
  supabase: SupabaseClient,
  workspaceId: string,
  idempotencyKey: string
): Promise<OutboundMessageRow | null> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select(OUTBOUND_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as OutboundMessageRow;
}

export async function listRecoverableOutbound(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<OutboundMessageRow[]> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select(OUTBOUND_SELECT)
    .eq("workspace_id", workspaceId)
    .in("status", [...RECOVERABLE_OUTBOUND_STATUSES])
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data as OutboundMessageRow[];
}

export async function loadOutboundMessage(
  supabase: SupabaseClient,
  messageId: string
): Promise<OutboundMessageRow | null> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select(OUTBOUND_SELECT)
    .eq("id", messageId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as OutboundMessageRow;
}
