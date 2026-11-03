import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isRevisionReadyForAcceptance,
  matchesExpectedAcceptanceRevision,
  notIssuedRevisionAcceptError,
  staleRevisionAcceptError,
  unsentRevisionAcceptError,
  hasUnsentRevision,
} from "@/lib/proposals/revision/unsent-revision";

export type AcceptAtRevisionSource =
  | "customer_portal"
  | "trader_acceptance"
  | "trader_booking";

export type AcceptAtRevisionResult = {
  ok: boolean;
  error?: string;
  alreadyAccepted?: boolean;
  staleRevision?: boolean;
  slotConflict?: boolean;
  contentRevision?: number;
  acceptedContentRevision?: number;
  acceptedTotalAmount?: number;
  acceptedAt?: string;
  workspaceId?: string;
};

type AcceptRpcResult = {
  ok?: boolean;
  error?: string;
  already_accepted?: boolean;
  stale_revision?: boolean;
  slot_conflict?: boolean;
  content_revision?: number;
  accepted_content_revision?: number;
  accepted_total_amount?: number;
  accepted_at?: string;
  workspace_id?: string;
};

/**
 * Soft precheck before calling the atomic accept RPC.
 * The RPC remains the source of truth.
 */
export function precheckAcceptAtRevision(input: {
  expectedContentRevision: number;
  unsent_revision_at?: string | null;
  content_revision?: number | null;
  issued_content_revision?: number | null;
  total_amount?: number | null;
}): { ok: true } | { ok: false; error: string; staleRevision?: boolean } {
  if (!Number.isFinite(input.expectedContentRevision)) {
    return {
      ok: false,
      error: "Missing proposal revision. Please refresh and try again.",
      staleRevision: true,
    };
  }

  if (hasUnsentRevision(input)) {
    return { ok: false, error: unsentRevisionAcceptError() };
  }

  const live = Number(input.content_revision ?? 0);
  if (live !== input.expectedContentRevision) {
    return {
      ok: false,
      error: staleRevisionAcceptError(),
      staleRevision: true,
    };
  }

  if (!isRevisionReadyForAcceptance(input)) {
    return { ok: false, error: notIssuedRevisionAcceptError() };
  }

  if (
    !matchesExpectedAcceptanceRevision({
      ...input,
      expectedContentRevision: input.expectedContentRevision,
    })
  ) {
    return {
      ok: false,
      error: staleRevisionAcceptError(),
      staleRevision: true,
    };
  }

  const total = Number(input.total_amount ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: "This proposal does not have a valid price." };
  }

  return { ok: true };
}

/**
 * Atomic acceptance transition. Side effects (job, email) must run only when
 * ok === true and alreadyAccepted is false (or treat alreadyAccepted as
 * success-without-duplicate-side-effects for portal retries).
 */
export async function acceptProposalAtRevision(
  supabase: SupabaseClient,
  input: {
    proposalId: string;
    expectedContentRevision: number;
    acceptedAt: string;
    bookingConfirmation: string | null;
    source: AcceptAtRevisionSource;
    requireWorkspaceOwner?: boolean;
    plannedStartDate?: string | null;
    plannedStartTime?: string | null;
    plannedStartDateText?: string | null;
    requireSlot?: boolean;
  }
): Promise<AcceptAtRevisionResult> {
  const { data, error } = await supabase.rpc("accept_proposal_at_revision", {
    p_proposal_id: input.proposalId,
    p_expected_content_revision: input.expectedContentRevision,
    p_accepted_at: input.acceptedAt,
    p_booking_confirmation: input.bookingConfirmation,
    p_source: input.source,
    // Authenticated traders always prove workspace ownership in the RPC.
    // Flag kept for call-site clarity; it cannot disable ownership checks.
    p_require_workspace_owner: Boolean(input.requireWorkspaceOwner),
    p_planned_start_date: input.plannedStartDate || null,
    p_planned_start_time: input.plannedStartTime || null,
    p_planned_start_date_text: input.plannedStartDateText || null,
    p_require_slot: Boolean(input.requireSlot),
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not accept this proposal.",
    };
  }

  const result = (data ?? {}) as AcceptRpcResult;
  if (!result.ok) {
    return {
      ok: false,
      error: result.error || "Could not accept this proposal.",
      staleRevision: Boolean(result.stale_revision),
      slotConflict: Boolean(result.slot_conflict),
    };
  }

  return {
    ok: true,
    alreadyAccepted: Boolean(result.already_accepted),
    contentRevision: result.content_revision,
    acceptedContentRevision: result.accepted_content_revision,
    acceptedTotalAmount: result.accepted_total_amount,
    acceptedAt: result.accepted_at || input.acceptedAt,
    workspaceId: result.workspace_id,
  };
}
