"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  canTransitionStatus,
  isProposalStatus,
  normalizeProposalStatus,
  type ProposalStatus,
} from "@/lib/proposals/status";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";

export type UpdateProposalStatusState = {
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function getTimestampUpdates(status: ProposalStatus): Record<string, string> {
  const now = new Date().toISOString();

  switch (status) {
    case "waiting_for_customer":
      return { sent_at: now };
    case "booked":
      return { booked_at: now, accepted_at: now };
    case "completed":
      return { completed_at: now };
    default:
      return {};
  }
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
    .select("id, status, workspace_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (!isProposalStatus(currentStatus)) {
    return { error: "This proposal has an unknown status." };
  }

  if (!canTransitionStatus(currentStatus, newStatus)) {
    return {
      error: `Cannot move a ${formatStatusLabel(currentStatus)} proposal to ${formatStatusLabel(newStatus)}.`,
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

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: newStatus,
    note: formatStatusLabel(newStatus),
  });

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/proposals/${proposalId}`);
  redirect(`/proposals/${proposalId}`);
}

function formatStatusLabel(status: ProposalStatus): string {
  return status.replaceAll("_", " ");
}
