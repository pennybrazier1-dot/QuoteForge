import type { SupabaseClient } from "@supabase/supabase-js";

export type WriteScheduleSlotResult =
  | { ok: true }
  | { ok: false; error: string; slotConflict?: boolean };

type WriteRpcResult = {
  ok?: boolean;
  error?: string;
  slot_conflict?: boolean;
};

/**
 * Shared locked schedule writer. Conflict check + persist happen together.
 */
export async function writeProposalScheduleSlot(
  supabase: SupabaseClient,
  input: {
    proposalId: string;
    plannedStartDate: string;
    plannedStartTime?: string | null;
    plannedStartDateText?: string | null;
    bookingConfirmation: "confirmed" | "provisional";
    nextStatus?: string | null;
    attentionReason?: string | null;
    estimatedDuration?: string | null;
    requireAvailable?: boolean;
    clearPendingDateSuggestion?: boolean;
  }
): Promise<WriteScheduleSlotResult> {
  const { data, error } = await supabase.rpc("write_proposal_schedule_slot", {
    p_proposal_id: input.proposalId,
    p_planned_start_date: input.plannedStartDate,
    p_planned_start_time: input.plannedStartTime || null,
    p_planned_start_date_text: input.plannedStartDateText || null,
    p_booking_confirmation: input.bookingConfirmation,
    p_next_status: input.nextStatus || null,
    p_attention_reason: input.attentionReason ?? null,
    p_estimated_duration: input.estimatedDuration || null,
    p_require_available: input.requireAvailable !== false,
    p_clear_pending_date_suggestion: Boolean(input.clearPendingDateSuggestion),
  });

  if (error) {
    return { ok: false, error: error.message || "Could not save this date." };
  }

  const result = (data ?? {}) as WriteRpcResult;
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error ||
        "That appointment was just taken. Please choose another time.",
      slotConflict: Boolean(result.slot_conflict),
    };
  }

  return { ok: true };
}
