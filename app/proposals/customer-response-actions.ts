"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  formatAttentionReason,
  isAttentionReason,
} from "@/lib/proposals/attention";
import { buildEstimatedDurationNote } from "@/lib/proposals/duration";
import {
  plannedStartToDbFields,
  normalizePlannedStartExact,
} from "@/lib/proposals/planned-start-date";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import {
  isProposalStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";

export type CustomerResponseState = {
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

export async function recordCustomerAcceptance(
  _prevState: CustomerResponseState,
  formData: FormData
): Promise<CustomerResponseState> {
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

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, planned_start_date_text, planned_start_date, estimated_duration"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (currentStatus !== "waiting_for_customer") {
    return { error: "Only sent quotes awaiting a customer reply can be accepted." };
  }

  const resolvedStartText =
    plannedStartDateText || proposal.planned_start_date_text || "";
  const resolvedStartExact =
    plannedStartDateExact ||
    (proposal.planned_start_date
      ? proposal.planned_start_date.slice(0, 10)
      : null);

  if (!resolvedStartText && !resolvedStartExact) {
    return {
      error: "Choose a start date before creating the calendar booking.",
    };
  }

  const plannedFields = plannedStartToDbFields({
    plannedStartDate: resolvedStartText,
    plannedStartDateExact: resolvedStartExact ?? "",
  });

  const now = new Date().toISOString();
  const duration = estimatedDuration || proposal.estimated_duration || "";

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "booked",
      booking_confirmation: "provisional",
      accepted_at: now,
      booked_at: now,
      attention_reason: null,
      estimated_duration: duration || null,
      things_to_confirm: buildEstimatedDurationNote(duration),
      ...plannedFields,
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not record customer acceptance.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "booked",
    note: "Customer accepted — provisional booking created",
    metadata: {
      booking_confirmation: "provisional",
      ...plannedFields,
      estimated_duration: duration || null,
    },
  });

  revalidateAll(proposalId);
  redirect(`/proposals/${proposalId}?confirmBooking=1`);
}

export async function recordCustomerAttention(
  _prevState: CustomerResponseState,
  formData: FormData
): Promise<CustomerResponseState> {
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
  const attentionReason = getString(formData, "attentionReason");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!isAttentionReason(attentionReason)) {
    return { error: "Choose what the customer needs." };
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

  if (currentStatus !== "waiting_for_customer") {
    return { error: "Only quotes awaiting a customer reply can move here." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "needs_attention",
      attention_reason: attentionReason,
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
    toStatus: "needs_attention",
    note: formatAttentionReason(attentionReason),
    metadata: { attention_reason: attentionReason },
  });

  revalidateAll(proposalId);
  redirect(`/proposals/${proposalId}`);
}

export async function recordCustomerDecline(
  _prevState: CustomerResponseState,
  formData: FormData
): Promise<CustomerResponseState> {
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
    .select("id, status, workspace_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (
    currentStatus !== "waiting_for_customer" &&
    currentStatus !== "needs_attention"
  ) {
    return { error: "This proposal cannot be declined from its current status." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "cancelled",
      attention_reason: null,
    })
    .eq("id", proposalId);

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
    fromStatus: currentStatus,
    toStatus: "cancelled",
    note: "Customer declined",
  });

  revalidateAll(proposalId);
  redirect("/dashboard");
}
