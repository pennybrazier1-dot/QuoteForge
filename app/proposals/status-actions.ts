"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  canTransitionStatus,
  isProposalStatus,
  type ProposalStatus,
} from "@/lib/proposals/status";

export type UpdateProposalStatusState = {
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function getTimestampUpdates(status: ProposalStatus): Record<string, string> {
  const now = new Date().toISOString();

  if (status === "sent") {
    return { sent_at: now };
  }

  if (status === "accepted") {
    return { accepted_at: now };
  }

  return {};
}

export async function updateProposalStatus(
  _prevState: UpdateProposalStatusState,
  formData: FormData
): Promise<UpdateProposalStatusState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update a proposal." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before updating proposals." };
  }

  const proposalId = getString(formData, "proposalId");
  const newStatusValue = getString(formData, "newStatus");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!isProposalStatus(newStatusValue)) {
    return { error: "That status change is not allowed." };
  }

  const newStatus = newStatusValue;

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  if (!isProposalStatus(proposal.status)) {
    return { error: "This proposal has an unknown status." };
  }

  if (!canTransitionStatus(proposal.status, newStatus)) {
    return {
      error: `Cannot move a ${proposal.status.replaceAll("_", " ")} proposal to ${newStatus.replaceAll("_", " ")}.`,
    };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: newStatus,
      ...getTimestampUpdates(newStatus),
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not update the proposal status.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/proposals/${proposalId}`);
  redirect(`/proposals/${proposalId}`);
}
