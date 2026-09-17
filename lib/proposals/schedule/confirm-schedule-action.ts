"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { ensureJobForAcceptedProposal } from "@/lib/jobs/create-job-from-proposal";
import { syncJobStatusForProposal } from "@/lib/jobs/sync-job-status";
import { notifyConversationParticipant } from "@/lib/proposals/customer-portal/conversation-notify";
import { buildEstimatedDurationNote } from "@/lib/proposals/duration";
import {
  isBookingConfirmation,
  type BookingConfirmation,
} from "@/lib/proposals/booking";
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
import { buildCustomerScheduleUpdateEmail } from "@/lib/email/transactional-events";

export type ConfirmScheduleState = {
  error?: string;
  ok?: boolean;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateSchedulePaths(proposalId: string, portalToken?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/proposals/${proposalId}/schedule`);
  revalidatePath("/calendar");
  if (portalToken) {
    revalidatePath(`/p/${portalToken}`);
  }
}

/**
 * Saves an actual job schedule only after proposal acceptance.
 * Pre-acceptance timing stays in the proposal conversation and never creates
 * a calendar booking or job.
 */
export async function confirmSchedule(
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
  const bookingConfirmation = getString(formData, "bookingConfirmation");
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
    return { error: "Choose a date on the calendar before confirming." };
  }

  if (!plannedStartTime) {
    return { error: "Choose a start time before confirming." };
  }

  if (!estimatedDuration) {
    return { error: "Enter an estimated duration before confirming." };
  }

  if (!isBookingConfirmation(bookingConfirmation)) {
    return { error: "Choose provisional or confirmed." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, booking_confirmation, accepted_at, customer_id, customer_name, customer_email, customer_phone, customer_address, job_address, planned_start_date, materials, customer_access_token, proposal_number, title"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);
  if (!isProposalStatus(currentStatus) || currentStatus !== "booked") {
    return {
      error:
        "Accept the proposal before scheduling the actual job. Discuss timing in the proposal conversation first.",
    };
  }

  const effectiveBookingConfirmation = bookingConfirmation as BookingConfirmation;

  const plannedFields = plannedStartToDbFields({
    plannedStartDate: plannedStartDateText,
    plannedStartDateExact,
  });

  const now = new Date().toISOString();
  const scheduleLabel = buildScheduleDateLabel({
    dateIso: plannedStartDateExact,
    time: plannedStartTime,
    fallbackText: plannedStartDateText,
  });

  const updatePayload: Record<string, unknown> = {
    estimated_duration: estimatedDuration,
    booking_confirmation: effectiveBookingConfirmation,
    things_to_confirm: buildEstimatedDurationNote(estimatedDuration),
    planned_start_time: plannedStartTime,
    ...plannedFields,
  };

  updatePayload.status = "booked";

  const { error: updateError } = await supabase
    .from("proposals")
    .update(updatePayload)
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not save this schedule.",
    };
  }

  const toStatus =
    typeof updatePayload.status === "string"
      ? normalizeProposalStatus(updatePayload.status)
      : currentStatus;

  const eventNote = `Job schedule saved: ${scheduleLabel} (${effectiveBookingConfirmation})`;

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus,
    note: eventNote,
    metadata: {
      source: "schedule_workspace",
      booking_confirmation: effectiveBookingConfirmation,
      planned_start_time: plannedStartTime,
      estimated_duration: estimatedDuration,
      ...plannedFields,
    },
  });

  // The job is created at acceptance. Scheduling only updates its actual dates.
  if (toStatus === "booked") {
    const jobResult = await ensureJobForAcceptedProposal(
      supabase,
      {
        id: proposal.id,
        workspace_id: proposal.workspace_id,
        customer_id: proposal.customer_id,
        customer_name: proposal.customer_name,
        customer_email: proposal.customer_email,
        customer_phone: proposal.customer_phone,
        customer_address: proposal.customer_address,
        job_address: proposal.job_address,
        planned_start_date:
          plannedFields.planned_start_date ?? proposal.planned_start_date,
        booking_confirmation: effectiveBookingConfirmation,
        accepted_at: proposal.accepted_at,
        status: "booked",
        materials: proposal.materials,
      }
    );

    if (jobResult.ok) {
      if (effectiveBookingConfirmation === "confirmed") {
        await syncJobStatusForProposal(supabase, proposal.id, "scheduled");
        await supabase
          .from("job_prep_items")
          .update({
            status: "confirmed",
            confirmed_at: now,
          })
          .eq("job_id", jobResult.job.id)
          .eq("item_key", "start_date");
      } else if (jobResult.job.status === "accepted") {
        await syncJobStatusForProposal(supabase, proposal.id, "preparing");
      }
    }
  }

  const portalToken = proposal.customer_access_token?.trim() || null;
  if (proposal.customer_email && portalToken) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("business_name, contact_email")
      .eq("id", proposal.workspace_id)
      .maybeSingle();

    const notification = buildCustomerScheduleUpdateEmail({
      businessName: workspace?.business_name,
      customerName: proposal.customer_name,
      scheduleLabel,
      estimatedDuration,
      confirmed: effectiveBookingConfirmation === "confirmed",
      portalToken,
    });

    await notifyConversationParticipant({
      to: proposal.customer_email,
      subject: notification.subject,
      message: notification.text,
      businessName: notification.businessName,
      ctaUrl: notification.ctaUrl,
      ctaLabel: notification.ctaLabel,
      html: notification.html,
      heading: notification.heading,
      preheader: notification.preheader,
      audience: notification.audience,
      replyTo: workspace?.contact_email,
    });
  }

  revalidateSchedulePaths(proposalId, proposal.customer_access_token);
  redirect(`/proposals/${proposalId}`);
}
