import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobStatus } from "@/lib/jobs/status";

export async function syncJobStatusForProposal(
  supabase: SupabaseClient,
  proposalId: string,
  status: JobStatus,
  timestamps?: {
    started_at?: string | null;
    completed_at?: string | null;
  }
): Promise<void> {
  const payload: Record<string, unknown> = { status };
  if (timestamps?.started_at !== undefined) {
    payload.started_at = timestamps.started_at;
  }
  if (timestamps?.completed_at !== undefined) {
    payload.completed_at = timestamps.completed_at;
  }

  await supabase.from("jobs").update(payload).eq("proposal_id", proposalId);
}
