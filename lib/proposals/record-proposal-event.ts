import type { SupabaseClient } from "@supabase/supabase-js";

type RecordProposalEventInput = {
  workspaceId: string;
  proposalId: string;
  userId: string;
  eventType: "status_change" | "rearranged";
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordProposalEvent(
  supabase: SupabaseClient,
  input: RecordProposalEventInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("proposal_status_events").insert({
    workspace_id: input.workspaceId,
    proposal_id: input.proposalId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
    created_by: input.userId,
  });

  if (error) {
    console.error("Failed to record proposal event:", error);
    return {
      ok: false,
      error: error.message ?? "Could not record the proposal event.",
    };
  }

  return { ok: true };
}
