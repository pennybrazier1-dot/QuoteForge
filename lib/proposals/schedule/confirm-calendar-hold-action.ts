"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { plannedStartToDbFields } from "@/lib/proposals/planned-start-date";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import {
  buildScheduleDateLabel,
  normalizePlannedStartTime,
} from "@/lib/proposals/schedule/schedule-fields";
import {
  isProposalStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";
import type { ConfirmScheduleState } from "@/lib/proposals/schedule/confirm-schedule-action";

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateHoldPaths(proposalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/proposals/${proposalId}/schedule`);
  revalidatePath("/calendar");
}

/**
 * Saves a provisional calendar hold before proposal acceptance.
 * Does not create a job, confirm a booking, or change proposal status.
 */
export async function confirmCalendarHold(
  _prev: ConfirmScheduleState,
  formData: FormData
): Promise<ConfirmScheduleState> {
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
  const plannedStartDateExact = getString(formData, "plannedStartDateExact");
  const plannedStartTime = normalizePlannedStartTime(
    getString(formData, "plannedStartTime")
  );
  const estimatedDuration = getString(formData, "estimatedDuration");
  const plannedStartDateText =
    getString(formData, "plannedStartDateText") ||
    buildScheduleDateLabel({
      dateIso: plannedStartDateExact,
      time: plannedStartTime,
    });

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!plannedStartDateExact) {
    return { error: "Choose a date on the calendar before holding it." };
  }

  if (!plannedStartTime) {
    return { error: "Choose a start time before holding this date." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, workspace_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);
  if (
    !isProposalStatus(currentStatus) ||
    (currentStatus !== "waiting_for_customer" &&
      currentStatus !== "needs_attention")
  ) {
    return {
      error:
        "Hold a date here only before the customer accepts the proposal.",
    };
  }

  const plannedFields = plannedStartToDbFields({
    plannedStartDate: plannedStartDateText,
    plannedStartDateExact,
  });
  const scheduleLabel = buildScheduleDateLabel({
    dateIso: plannedStartDateExact,
    time: plannedStartTime,
    fallbackText: plannedStartDateText,
  });

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      estimated_duration: estimatedDuration || null,
      planned_start_time: plannedStartTime,
      ...plannedFields,
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not save this calendar hold.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: currentStatus,
    note: `Calendar hold saved: ${scheduleLabel} (not a job)`,
    metadata: {
      source: "calendar_hold",
      planned_start_time: plannedStartTime,
      estimated_duration: estimatedDuration || null,
      ...plannedFields,
    },
  });

  revalidateHoldPaths(proposalId);
  redirect(`/proposals/${proposalId}`);
}
