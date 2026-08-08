"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type ChangeRequestActionState = {
  error?: string;
  ok?: boolean;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Clears change-request attention without editing or resending the proposal.
 */
export async function markChangeRequestResolved(
  _prev: ChangeRequestActionState,
  formData: FormData
): Promise<ChangeRequestActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = getString(formData, "proposalId");
  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, workspace_id, attention_reason")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);
  if (currentStatus !== "needs_attention") {
    return {
      error: "Only open customer requests can be marked resolved.",
    };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "waiting_for_customer",
      attention_reason: null,
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not mark this request resolved.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "waiting_for_customer",
    note: "Change request marked resolved",
    metadata: {
      source: "trader",
      action: "mark_change_request_resolved",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  redirect(`/proposals/${proposalId}`);
}
