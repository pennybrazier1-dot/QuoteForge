"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { buildEstimatedDurationNote } from "@/lib/proposals/duration";
import {
  plannedStartToDbFields,
  normalizePlannedStartExact,
} from "@/lib/proposals/planned-start-date";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import {
  canCancelProposal,
  isProposalStatus,
} from "@/lib/proposals/status";

export type ProposalManagementState = {
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function loadManagedProposal(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to manage proposals." as const };
  }

  if (!(await userHasProfile(user.id))) {
    return {
      error: "Please complete onboarding before managing proposals." as const,
    };
  }

  if (!proposalId) {
    return { error: "Proposal not found." as const };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, proposal_number, workspace_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." as const };
  }

  return { supabase, user, proposal };
}

function revalidateProposalPaths(proposalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
}

export async function deleteProposal(
  _prevState: ProposalManagementState,
  formData: FormData
): Promise<ProposalManagementState> {
  const proposalId = getString(formData, "proposalId");
  const loaded = await loadManagedProposal(proposalId);

  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, proposal } = loaded;

  const { error: deleteError } = await supabase
    .from("proposals")
    .delete()
    .eq("id", proposal.id);

  if (deleteError) {
    return {
      error: deleteError.message ?? "Could not delete this proposal.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  redirect("/dashboard");
}

export async function cancelProposal(
  _prevState: ProposalManagementState,
  formData: FormData
): Promise<ProposalManagementState> {
  const proposalId = getString(formData, "proposalId");
  const returnTo = getString(formData, "returnTo");
  const loaded = await loadManagedProposal(proposalId);

  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, user, proposal } = loaded;

  if (!isProposalStatus(proposal.status)) {
    return { error: "This proposal has an unknown status." };
  }

  if (!canCancelProposal(proposal.status)) {
    return { error: "This proposal is already cancelled." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({ status: "cancelled" })
    .eq("id", proposal.id);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not cancel this proposal.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: proposal.status,
    toStatus: "cancelled",
    note: "Cancelled",
  });

  revalidateProposalPaths(proposal.id);

  if (returnTo === "dashboard") {
    redirect("/dashboard");
  }

  redirect(`/proposals/${proposal.id}`);
}

export async function rearrangeProposal(
  _prevState: ProposalManagementState,
  formData: FormData
): Promise<ProposalManagementState> {
  const proposalId = getString(formData, "proposalId");
  const loaded = await loadManagedProposal(proposalId);

  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, user, proposal } = loaded;

  const plannedStartDateText = getString(formData, "plannedStartDateText");
  const plannedStartDateExact = normalizePlannedStartExact(
    getString(formData, "plannedStartDateExact")
  );
  const estimatedDuration = getString(formData, "estimatedDuration");

  const { data: existing, error: existingError } = await supabase
    .from("proposals")
    .select(
      "estimated_duration, planned_start_date_text, planned_start_date"
    )
    .eq("id", proposal.id)
    .maybeSingle();

  if (existingError || !existing) {
    return { error: "Proposal not found." };
  }

  const plannedFields = plannedStartToDbFields({
    plannedStartDate: plannedStartDateText,
    plannedStartDateExact: plannedStartDateExact ?? "",
  });

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      estimated_duration: estimatedDuration || null,
      things_to_confirm: buildEstimatedDurationNote(estimatedDuration),
      ...plannedFields,
    })
    .eq("id", proposal.id);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not update the schedule.",
    };
  }

  const changes: string[] = [];

  if ((existing.planned_start_date_text ?? "") !== (plannedFields.planned_start_date_text ?? "")) {
    changes.push("planned start date");
  }

  if ((existing.planned_start_date ?? "") !== (plannedFields.planned_start_date ?? "")) {
    changes.push("calendar date");
  }

  if ((existing.estimated_duration ?? "") !== (estimatedDuration || "")) {
    changes.push("estimated duration");
  }

  const note =
    changes.length > 0
      ? `Date changed (${changes.join(", ")})`
      : "Rearranged";

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "rearranged",
    fromStatus: proposal.status,
    toStatus: proposal.status,
    note,
    metadata: {
      planned_start_date_text: plannedFields.planned_start_date_text,
      planned_start_date: plannedFields.planned_start_date,
      estimated_duration: estimatedDuration || null,
    },
  });

  revalidateProposalPaths(proposal.id);
  redirect(`/proposals/${proposal.id}`);
}
