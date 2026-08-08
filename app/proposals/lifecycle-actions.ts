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
  isBookingConfirmation,
  isProvisionalBooking,
} from "@/lib/proposals/booking";
import { ensureJobForAcceptedProposal } from "@/lib/jobs/create-job-from-proposal";
import { syncJobStatusForProposal } from "@/lib/jobs/sync-job-status";
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
  const bookingConfirmation = getString(formData, "bookingConfirmation");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!plannedStartDateText && !plannedStartDateExact) {
    return { error: "Choose a start date for the calendar." };
  }

  if (!isBookingConfirmation(bookingConfirmation)) {
    return { error: "Choose a booking status." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, booking_confirmation, accepted_at, customer_id, customer_name, customer_email, customer_phone, customer_address, job_address, planned_start_date, materials"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);
  const isAwaitingAcceptance = currentStatus === "waiting_for_customer";
  const isProvisional = isProvisionalBooking(
    currentStatus,
    proposal.booking_confirmation
  );
  const isNeedsAttention = currentStatus === "needs_attention";

  if (
    !isProposalStatus(currentStatus) ||
    (!isAwaitingAcceptance && !isProvisional && !isNeedsAttention)
  ) {
    return {
      error:
        "Only quotes awaiting acceptance, needing attention, or provisional bookings can update dates here.",
    };
  }

  const plannedFields = plannedStartToDbFields({
    plannedStartDate: plannedStartDateText,
    plannedStartDateExact: plannedStartDateExact ?? "",
  });

  const now = new Date().toISOString();

  // From revision review on needs_attention: save planned start/duration only.
  // Do not auto-book, create jobs, or email the customer.
  if (isNeedsAttention) {
    const { error: planError } = await supabase
      .from("proposals")
      .update({
        estimated_duration: estimatedDuration || null,
        ...plannedFields,
      })
      .eq("id", proposalId);

    if (planError) {
      return {
        error: planError.message ?? "Could not save the planned start date.",
      };
    }

    await recordProposalEvent(supabase, {
      workspaceId: proposal.workspace_id,
      proposalId: proposal.id,
      userId: user.id,
      eventType: "status_change",
      fromStatus: currentStatus,
      toStatus: currentStatus,
      note: "Planned start updated from conversation revision (not booked)",
      metadata: {
        source: "revision_calendar_action",
        booking_confirmation: bookingConfirmation,
        ...plannedFields,
        estimated_duration: estimatedDuration || null,
      },
    });

    revalidateAll(proposalId);
    redirect(`/proposals/${proposalId}`);
  }

  const updatePayload: Record<string, unknown> = {
    status: "booked",
    booking_confirmation: bookingConfirmation,
    estimated_duration: estimatedDuration || null,
    things_to_confirm: buildEstimatedDurationNote(estimatedDuration),
    attention_reason: null,
    ...plannedFields,
  };

  if (isAwaitingAcceptance) {
    updatePayload.accepted_at = now;
    updatePayload.booked_at = now;
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update(updatePayload)
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not confirm this booking.",
    };
  }

  const eventNote = isAwaitingAcceptance
    ? bookingConfirmation === "confirmed"
      ? "Quote accepted — booking confirmed on calendar"
      : "Quote accepted — provisional booking on calendar"
    : bookingConfirmation === "confirmed"
      ? "Booking confirmed"
      : "Booking details updated";

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "booked",
    note: eventNote,
    metadata: {
      booking_confirmation: bookingConfirmation,
      ...plannedFields,
      estimated_duration: estimatedDuration || null,
    },
  });

  const jobResult = await ensureJobForAcceptedProposal(supabase, {
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
    materials: proposal.materials,
  }, { acceptedAt: now });

  if (!jobResult.ok) {
    return {
      error:
        jobResult.error ||
        "Booking was saved, but the job could not be created.",
    };
  }

  if (bookingConfirmation === "confirmed") {
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

  await syncJobStatusForProposal(supabase, proposal.id, "completed", {
    completed_at: now,
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
