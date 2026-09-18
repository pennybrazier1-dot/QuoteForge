"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatAttentionReason } from "@/lib/proposals/attention";
import {
  buildTraderMessageNotification,
  notifyConversationParticipant,
} from "@/lib/proposals/customer-portal/conversation-notify";
import { shouldFlagAttentionForCustomerMessage } from "@/lib/proposals/customer-portal/conversation-access";
import { loadPublicProposalByToken } from "@/lib/proposals/customer-portal/load-public-proposal";
import { buildCustomerProposalPortalUrl } from "@/lib/proposals/customer-portal/token";
import { ensureJobForAcceptedProposal } from "@/lib/jobs/create-job-from-proposal";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import {
  bookingConfirmationAfterCustomerAccept,
  canShowFinalAccept,
  hasExactWorkSchedule,
} from "@/lib/proposals/acceptance-rules";
import { decodePublicSlotId } from "@/lib/proposals/customer-availability";
import { loadWorkspaceOccupiedSlots } from "@/lib/proposals/customer-availability-load";
import { buildBookingConfirmationEmail } from "@/lib/email/booking-confirmation-email";
import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import { loadWorkspaceEmailLogoUrl } from "@/lib/proposals/pdf/customer-branding";
import { plannedStartToDbFields } from "@/lib/proposals/planned-start-date";
import { buildScheduleDateLabel } from "@/lib/proposals/schedule/schedule-fields";
import {
  holdExpiresAt,
  isSlotTakenByOther,
  TEMP_HOLD_ACTION,
} from "@/lib/proposals/slot-hold";
import {
  applyCustomerConfirmDate,
  applyCustomerRequestAnotherDate,
  buildDateWorkflowSnapshot,
  nextStatusAfterDateResolved,
} from "@/lib/proposals/date-workflow";
import {
  hasOtherUnresolvedWorkRequests,
  promoteBookedJobIfReady,
  releaseProposalDateHold,
} from "@/lib/proposals/date-workflow-persist";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type CustomerPortalActionState = {
  ok?: boolean;
  error?: string;
  result?:
    | "accepted"
    | "question"
    | "changes"
    | "date_accepted"
    | "date_change_requested"
    | "declined"
    | "slot_held";
};

function createPortalClient() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function revalidateTraderViews(proposalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
}

export async function acceptPublicProposal(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const note = getString(formData, "note");

  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (!loaded.view.canRespond || loaded.view.isAccepted || loaded.view.isClosed) {
    return { error: "This proposal can no longer be accepted." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const slotId = getString(formData, "slotId");
  if (slotId) {
    const held = await applyPublicSlotHold(supabase, loaded, slotId, {
      confirmImmediately: true,
    });
    if (!held.ok) {
      return { error: held.error };
    }
    loaded.proposal.planned_start_date = held.startDate;
    loaded.proposal.planned_start_time = held.startTime ?? null;
    loaded.proposal.planned_start_date_text = held.dateText;
  }

  const canAccept = canShowFinalAccept({
    canRespond: true,
    plannedStartDate: loaded.proposal.planned_start_date,
    plannedStartTime: loaded.proposal.planned_start_time,
    estimatedDuration: loaded.proposal.estimated_duration,
  });
  if (!canAccept) {
    return {
      error: "Please choose an available date before accepting this proposal.",
    };
  }

  const fromStatus = normalizeProposalStatus(loaded.proposal.status);
  const acceptedAt = new Date().toISOString();
  const bookingConfirmation = bookingConfirmationAfterCustomerAccept(
    hasExactWorkSchedule({
      plannedStartDate: loaded.proposal.planned_start_date,
      plannedStartTime: loaded.proposal.planned_start_time,
      estimatedDuration: loaded.proposal.estimated_duration,
    })
  );

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "booked",
      booking_confirmation: bookingConfirmation,
      accepted_at: acceptedAt,
      booked_at: acceptedAt,
      attention_reason: null,
    })
    .eq("id", loaded.proposal.id)
    .in("status", ["waiting_for_customer", "needs_attention"]);

  if (updateError) {
    return { error: updateError.message || "Could not accept this proposal." };
  }

  if (note) {
    await supabase.from("proposal_customer_messages").insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      kind: "accept_note",
      direction: "customer",
      body: note,
      created_by: null,
    });
  }

  await supabase.from("proposal_status_events").insert({
    workspace_id: loaded.workspaceId,
    proposal_id: loaded.proposal.id,
    event_type: "status_change",
    from_status: fromStatus,
    to_status: "booked",
    note: note
      ? `Customer accepted the proposal: ${note}`
      : "Customer accepted the proposal",
    metadata: {
      source: "customer_portal",
      action: "accept",
      has_note: Boolean(note),
    },
    created_by: null,
    created_at: acceptedAt,
  });

  const jobResult = await ensureJobForAcceptedProposal(
    supabase,
    {
      id: loaded.proposal.id,
      workspace_id: loaded.workspaceId,
      customer_id: loaded.proposal.customer_id ?? null,
      customer_name: loaded.proposal.customer_name ?? null,
      customer_email: loaded.proposal.customer_email ?? null,
      customer_phone: loaded.proposal.customer_phone ?? null,
      customer_address: loaded.proposal.customer_address ?? null,
      job_address: loaded.proposal.job_address ?? null,
      planned_start_date: loaded.proposal.planned_start_date ?? null,
      booking_confirmation: bookingConfirmation,
      accepted_at: acceptedAt,
      status: "booked",
      materials: loaded.proposal.materials,
    },
    { acceptedAt }
  );

  if (!jobResult.ok) {
    return {
      error:
        jobResult.error ||
        "Proposal was accepted, but the job could not be created.",
    };
  }

  await promoteBookedJobIfReady(supabase, {
    ...loaded.proposal,
    status: "booked",
    accepted_at: acceptedAt,
    booking_confirmation: bookingConfirmation,
  }, { acceptedAt });

  await sendCustomerBookingConfirmation(loaded, acceptedAt);

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);

  return { ok: true, result: "accepted" };
}

export async function askPublicProposalQuestion(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  return submitAttentionMessage(formData, "question", "customer_question");
}

export async function requestPublicProposalChanges(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  return submitAttentionMessage(
    formData,
    "change_request",
    "customer_requested_changes"
  );
}

async function submitAttentionMessage(
  formData: FormData,
  kind: "question" | "change_request",
  attentionReason: "customer_question" | "customer_requested_changes"
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const message = getString(formData, "message");

  if (!message) {
    return { error: "Please enter a message." };
  }

  if (message.length > 4000) {
    return { error: "Please keep your message under 4,000 characters." };
  }

  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (kind === "question") {
    if (!loaded.view.canMessage || loaded.view.isClosed) {
      return { error: "This conversation is no longer open for replies." };
    }
  } else if (!loaded.view.canRespond || loaded.view.isClosed) {
    return { error: "This proposal is no longer open for replies." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const fromStatus = normalizeProposalStatus(loaded.proposal.status);

  const { error: messageError } = await supabase
    .from("proposal_customer_messages")
    .insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      kind,
      direction: "customer",
      body: message,
      created_by: null,
    });

  if (messageError) {
    return { error: messageError.message || "Could not send your message." };
  }

  if (shouldFlagAttentionForCustomerMessage(fromStatus, message)) {
    const { error: updateError } = await supabase
      .from("proposals")
      .update({
        status: "needs_attention",
        attention_reason: attentionReason,
      })
      .eq("id", loaded.proposal.id)
      .in("status", ["waiting_for_customer", "needs_attention"]);

    if (updateError) {
      return { error: updateError.message || "Could not update this proposal." };
    }

    await supabase.from("proposal_status_events").insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      event_type: "status_change",
      from_status: fromStatus,
      to_status: "needs_attention",
      note: `${formatAttentionReason(attentionReason)}: ${message}`,
      metadata: {
        source: "customer_portal",
        action: kind,
        attention_reason: attentionReason,
      },
      created_by: null,
    });
  }

  const traderEmail = loaded.workspace.contact_email?.trim() || null;
  if (traderEmail) {
    const notification = buildTraderMessageNotification({
      businessName: loaded.workspace.business_name,
      customerName: loaded.view.customerName,
      proposalNumber: loaded.view.proposalNumber,
      preview: message,
      proposalId: loaded.proposal.id,
      kindLabel: kind === "change_request" ? "change request" : "question",
      jobTitle: loaded.view.title,
    });
    await notifyConversationParticipant({
      to: traderEmail,
      ...notification,
      replyTo: loaded.proposal.customer_email,
    });
  }

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);

  return {
    ok: true,
    result: kind === "question" ? "question" : "changes",
  };
}

/**
 * Customer accepts a provisional date proposed by the trader.
 * Confirms booking_confirmation only — does not silently rewrite other fields.
 */
export async function acceptProposedScheduleDate(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (!loaded.view.canRespondToProposedDate || !loaded.view.proposedDateLabel) {
    return { error: "There is no provisional date waiting for your response." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const snapshot = buildDateWorkflowSnapshot({
    status: loaded.proposal.status,
    acceptedAt: loaded.proposal.accepted_at,
    bookingConfirmation: loaded.proposal.booking_confirmation,
    plannedStartDate: loaded.proposal.planned_start_date,
    plannedStartTime: loaded.proposal.planned_start_time,
  });
  const transition = applyCustomerConfirmDate(snapshot.dateState);
  const fromStatus = normalizeProposalStatus(loaded.proposal.status);
  const now = new Date().toISOString();
  const dateLabel = loaded.view.proposedDateLabel;
  const messages = await loadProposalCustomerMessages(
    supabase,
    loaded.proposal.id
  );
  const nextStatus = nextStatusAfterDateResolved({
    proposalAccepted: snapshot.proposalAccepted,
    hasOtherUnresolvedRequests: hasOtherUnresolvedWorkRequests(messages),
  });

  if (transition.changed) {
    const dateUpdate: Record<string, unknown> = {
      booking_confirmation: "confirmed",
      status: nextStatus,
    };
    if (nextStatus !== "needs_attention") {
      dateUpdate.attention_reason = null;
    }

    const { error: updateError } = await supabase
      .from("proposals")
      .update(dateUpdate)
      .eq("id", loaded.proposal.id)
      .eq("booking_confirmation", "provisional")
      .in("status", ["waiting_for_customer", "needs_attention", "booked"]);

    if (updateError) {
      return { error: updateError.message || "Could not confirm this date." };
    }

    await supabase.from("proposal_customer_messages").insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      kind: "question",
      direction: "customer",
      body: `Yes, ${dateLabel} works for me.`,
      created_by: null,
    });

    await supabase.from("proposal_status_events").insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      event_type: "status_change",
      from_status: fromStatus,
      to_status: nextStatus,
      note: `Customer confirmed date: ${dateLabel}`,
      metadata: {
        source: "customer_portal",
        action: "confirm_date",
        booking_confirmation: "confirmed",
        accepts_proposal: false,
        planned_start_label: dateLabel,
      },
      created_by: null,
      created_at: now,
    });
  }

  await promoteBookedJobIfReady(supabase, {
    ...loaded.proposal,
    status: snapshot.proposalAccepted ? "booked" : nextStatus,
    accepted_at: loaded.proposal.accepted_at,
    booking_confirmation: "confirmed",
  }, { acceptedAt: now });

  const traderEmail = loaded.workspace.contact_email?.trim() || null;
  if (traderEmail) {
    const notification = buildTraderMessageNotification({
      businessName: loaded.workspace.business_name,
      customerName: loaded.view.customerName,
      proposalNumber: loaded.view.proposalNumber,
      preview: `Accepted proposed date: ${dateLabel}`,
      proposalId: loaded.proposal.id,
      kindLabel: "date confirmation",
      jobTitle: loaded.view.title,
    });
    await notifyConversationParticipant({
      to: traderEmail,
      ...notification,
      replyTo: loaded.proposal.customer_email,
    });
  }

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);
  revalidatePath("/calendar");

  return { ok: true, result: "date_accepted" };
}

/**
 * Customer asks for a different date after a provisional proposal.
 */
/** Time changes use the same existing date/availability request path. */
export async function requestAnotherScheduleTime(
  prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  if (!getString(formData, "changeFocus")) {
    formData.set("changeFocus", "time");
  }
  return requestAnotherScheduleDate(prev, formData);
}

export async function requestAnotherScheduleDate(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const requestedDate = getString(formData, "requestedDate");
  const requestedTime = getString(formData, "requestedTime");
  const changeFocus = getString(formData, "changeFocus") || "date";
  const typedMessage = getString(formData, "message");
  const message =
    typedMessage ||
    (changeFocus === "time"
      ? requestedTime
        ? `I'd like this time instead: ${requestedTime}.`
        : "I'd like a different time."
      : requestedDate
        ? `I'd like this date instead: ${requestedDate}.`
        : "I'd like a different date.");

  if (!typedMessage && !requestedDate && !requestedTime) {
    return {
      error:
        changeFocus === "time"
          ? "Please choose a time that would work."
          : "Please choose a date that would work.",
    };
  }

  if (message.length > 4000) {
    return { error: "Please keep your message under 4,000 characters." };
  }

  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (!loaded.view.canRespond || loaded.view.isClosed) {
    return { error: "This proposal is no longer open for replies." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const currentDate = loaded.view.proposedDateLabel;
  const timeFocus = changeFocus === "time";

  const { error: messageError } = await supabase
    .from("proposal_customer_messages")
    .insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      kind: "change_request",
      direction: "customer",
      body: [
        currentDate
          ? timeFocus
            ? `I'd like a different time instead of ${currentDate}.`
            : `I'd like a different date instead of ${currentDate}.`
          : timeFocus
            ? "I'd like a different time."
            : "I'd like a different date.",
        requestedDate ? `Requested date: ${requestedDate}` : "",
        requestedTime ? `Requested time: ${requestedTime}` : "",
        typedMessage,
      ]
        .filter(Boolean)
        .join("\n"),
      created_by: null,
    });

  if (messageError) {
    return { error: messageError.message || "Could not send your message." };
  }

  const release = applyCustomerRequestAnotherDate();
  const released = await releaseProposalDateHold(supabase, loaded.proposal, {
    nextStatus: "needs_attention",
    eventNote: `${formatAttentionReason("customer_requested_date_change")}: ${message}`,
    attentionReason: release.attentionReason,
    metadata: {
      action: timeFocus ? "request_another_time" : "request_another_date",
      previous_proposed_date: currentDate,
      requested_date: requestedDate || null,
      requested_time: requestedTime || null,
    },
  });

  if (released.error) {
    return { error: released.error };
  }

  const traderEmail = loaded.workspace.contact_email?.trim() || null;
  if (traderEmail) {
    const notification = buildTraderMessageNotification({
      businessName: loaded.workspace.business_name,
      customerName: loaded.view.customerName,
      proposalNumber: loaded.view.proposalNumber,
      preview: message,
      proposalId: loaded.proposal.id,
      kindLabel: timeFocus ? "time change request" : "date change request",
      jobTitle: loaded.view.title,
    });
    await notifyConversationParticipant({
      to: traderEmail,
      ...notification,
      replyTo: loaded.proposal.customer_email,
    });
  }

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);

  return { ok: true, result: "date_change_requested" };
}

export async function declinePublicProposal(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const note = getString(formData, "note");

  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (!loaded.view.canRespond || loaded.view.isAccepted || loaded.view.isClosed) {
    return { error: "This proposal can no longer be declined." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const fromStatus = normalizeProposalStatus(loaded.proposal.status);

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "declined",
      attention_reason: null,
    })
    .eq("id", loaded.proposal.id)
    .in("status", ["waiting_for_customer", "needs_attention"]);

  if (updateError) {
    return { error: updateError.message || "Could not decline this proposal." };
  }

  await supabase.from("proposal_status_events").insert({
    workspace_id: loaded.workspaceId,
    proposal_id: loaded.proposal.id,
    event_type: "status_change",
    from_status: fromStatus,
    to_status: "declined",
    note: note
      ? `Customer declined: ${note}`
      : "Customer declined the proposal",
    metadata: {
      source: "customer_portal",
      action: "declined",
    },
    created_by: null,
  });

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);

  return { ok: true, result: "declined" };
}

export async function holdPublicAvailabilitySlot(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const slotId = getString(formData, "slotId");
  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }
  if (!loaded.view.canRespond || loaded.view.isClosed) {
    return { error: "This proposal is no longer open." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const held = await applyPublicSlotHold(supabase, loaded, slotId, {
    confirmImmediately: false,
  });
  if (!held.ok) {
    return { error: held.error };
  }

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);
  return { ok: true, result: "slot_held" };
}

async function applyPublicSlotHold(
  supabase: NonNullable<ReturnType<typeof createPortalClient>>,
  loaded: Extract<
    Awaited<ReturnType<typeof loadPublicProposalByToken>>,
    { ok: true }
  >,
  slotId: string,
  options: { confirmImmediately: boolean }
): Promise<
  | {
      ok: true;
      startDate: string;
      startTime: string | null;
      dateText: string;
    }
  | { ok: false; error: string }
> {
  const decoded = decodePublicSlotId(slotId);
  if (!decoded) {
    return { error: "Please choose an available date.", ok: false };
  }

  const now = new Date();
  const occupied = await loadWorkspaceOccupiedSlots(
    supabase,
    loaded.workspaceId,
    now
  );
  if (
    isSlotTakenByOther(
      {
        startDate: decoded.startDate,
        endDate: decoded.endDate || decoded.startDate,
        startTime: decoded.startTime || "09:00",
      },
      occupied,
      loaded.proposal.id,
      now
    )
  ) {
    return {
      ok: false,
      error: "That time is no longer available. Please choose another.",
    };
  }

  const startTime = decoded.startTime || "09:00";
  const dateText = buildScheduleDateLabel({
    dateIso: decoded.startDate,
    time: startTime,
  });
  const plannedFields = plannedStartToDbFields({
    plannedStartDate: dateText,
    plannedStartDateExact: decoded.startDate,
  });

  const { error } = await supabase
    .from("proposals")
    .update({
      booking_confirmation: options.confirmImmediately
        ? "confirmed"
        : "provisional",
      planned_start_time: startTime,
      ...plannedFields,
    })
    .eq("id", loaded.proposal.id);

  if (error) {
    return { ok: false, error: error.message || "Could not hold that date." };
  }

  if (!options.confirmImmediately) {
    await supabase.from("proposal_status_events").insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      event_type: "status_change",
      from_status: loaded.proposal.status,
      to_status: loaded.proposal.status,
      note: "Customer selected an available slot",
      metadata: {
        source: "customer_portal",
        action: TEMP_HOLD_ACTION,
        hold_kind: "customer_temp",
        hold_expires_at: holdExpiresAt(now),
        planned_start_date: decoded.startDate,
        planned_start_time: startTime,
      },
      created_by: null,
    });
  }

  return {
    ok: true,
    startDate: decoded.startDate,
    startTime,
    dateText,
  };
}

async function sendCustomerBookingConfirmation(
  loaded: Extract<
    Awaited<ReturnType<typeof loadPublicProposalByToken>>,
    { ok: true }
  >,
  acceptedAt: string
) {
  const to = loaded.proposal.customer_email?.trim();
  if (!to) {
    return;
  }

  const portalUrl = buildCustomerProposalPortalUrl(loaded.view.token);
  const email = buildBookingConfirmationEmail({
    businessName: loaded.workspace.business_name,
    businessLogoUrl: loadWorkspaceEmailLogoUrl(loaded.workspace),
    businessTradeLabel: loaded.workspace.trade_type,
    customerName: loaded.view.customerName,
    portalUrl,
    title: loaded.view.title,
    jobSummary: loaded.proposal.job_summary,
    proposalNumber: loaded.view.proposalNumber,
    plannedStartDate: loaded.proposal.planned_start_date,
    plannedStartDateText: loaded.proposal.planned_start_date_text,
    plannedStartTime: loaded.proposal.planned_start_time,
    estimatedDuration:
      loaded.view.estimatedDuration || loaded.proposal.estimated_duration,
  });

  await sendNotificationEmail({
    to,
    subject: email.subject,
    message: email.text,
    html: email.html,
    businessName: email.businessName,
    replyTo: loaded.workspace.contact_email,
    ctaUrl: portalUrl,
    ctaLabel: "View booking",
  });

  void acceptedAt;
}

