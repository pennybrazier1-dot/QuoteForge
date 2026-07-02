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
import { isProvisionalBooking } from "@/lib/proposals/booking";
import {
  isProposalStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";

export type LifecycleActionState = {
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateAll(proposalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
}

export async function confirmBooking(
  _prevState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
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
  const plannedStartDateText = getString(formData, "plannedStartDateText");
  const plannedStartDateExact = normalizePlannedStartExact(
    getString(formData, "plannedStartDateExact")
  );
  const estimatedDuration = getString(formData, "estimatedDuration");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!plannedStartDateText && !plannedStartDateExact) {
    return { error: "Choose a confirmed start date." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, workspace_id, booking_confirmation")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (
    !isProposalStatus(currentStatus) ||
    !isProvisionalBooking(currentStatus, proposal.booking_confirmation)
  ) {
    return { error: "Only provisional bookings can be confirmed." };
  }

  const plannedFields = plannedStartToDbFields({
    plannedStartDate: plannedStartDateText,
    plannedStartDateExact: plannedStartDateExact ?? "",
  });

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      booking_confirmation: "confirmed",
      estimated_duration: estimatedDuration || null,
      things_to_confirm: buildEstimatedDurationNote(estimatedDuration),
      ...plannedFields,
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not confirm this booking.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: currentStatus,
    note: "Booking confirmed",
    metadata: {
      booking_confirmation: "confirmed",
      ...plannedFields,
      estimated_duration: estimatedDuration || null,
    },
  });

  revalidateAll(proposalId);
  redirect(`/proposals/${proposalId}`);
}

export async function markJobComplete(
  _prevState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
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
    .select("id, status, workspace_id, booking_confirmation")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (currentStatus !== "booked" || proposal.booking_confirmation !== "confirmed") {
    return { error: "Only confirmed booked jobs can be marked complete." };
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "completed",
      completed_at: now,
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not mark this job complete.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "completed",
    note: "Job completed",
  });

  revalidateAll(proposalId);
  redirect(`/proposals/${proposalId}`);
}

export async function resendToCustomer(
  _prevState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const proposalId = getString(formData, "proposalId");

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, workspace_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (currentStatus !== "needs_attention") {
    return { error: "Only proposals needing attention can be sent back." };
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
      error: updateError.message ?? "Could not update this proposal.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "waiting_for_customer",
    note: "Updated quote sent back to customer",
  });

  revalidateAll(proposalId);
  redirect(`/proposals/${proposalId}`);
}
