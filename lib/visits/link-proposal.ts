import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

/** Attach a newly created proposal to its source visit (best-effort). */
export async function linkVisitToProposal(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    visitId: string | null | undefined;
    proposalId: string;
  }
): Promise<void> {
  const visitId = options.visitId?.trim();
  if (!visitId) {
    return;
  }

  await supabase
    .from("visits")
    .update({ linked_proposal_id: options.proposalId })
    .eq("id", visitId)
    .eq("workspace_id", options.workspaceId)
    .is("linked_proposal_id", null);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/visits");
}
