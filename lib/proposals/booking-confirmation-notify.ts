"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { buildBookingConfirmationEmail } from "@/lib/email/booking-confirmation-email";
import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import { loadWorkspaceEmailLogoUrl } from "@/lib/proposals/pdf/customer-branding";
import { buildCustomerProposalPortalUrl } from "@/lib/proposals/customer-portal/token";
import { BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY } from "@/lib/proposals/booking-confirmation-copy";

export type BookingConfirmNotifyState = {
  error?: string;
  ok?: boolean;
  providerAccepted?: boolean;
  unknownOutcome?: boolean;
  messageId?: string;
};

export type BookingConfirmStatus =
  | "needed"
  | "sent"
  | "failed"
  | "unknown"
  | null;

type NotifyDeps = {
  sendEmail?: typeof sendNotificationEmail;
};

/**
 * Send (or record failure of) the customer booking confirmation.
 * Acceptance must already be recorded. Never re-accepts or creates jobs.
 */
export async function deliverBookingConfirmationEmail(
  supabase: SupabaseClient,
  input: {
    proposalId: string;
    workspaceId: string;
    token: string;
    to: string;
    businessName: string | null;
    businessLogoUrl?: string | null;
    businessTradeLabel?: string | null;
    contactEmail?: string | null;
    customerName?: string | null;
    title?: string | null;
    jobSummary?: string | null;
    proposalNumber?: string | null;
    plannedStartDate?: string | null;
    plannedStartDateText?: string | null;
    plannedStartTime?: string | null;
    estimatedDuration?: string | null;
  },
  deps: NotifyDeps = {}
): Promise<BookingConfirmNotifyState> {
  const to = input.to.trim();
  if (!to) {
    return { ok: true };
  }

  // Claim before send so concurrent retries cannot both deliver.
  // Transitions needed/failed → unknown (no message id) as the in-flight lock.
  const claimed = await claimBookingConfirmSend(supabase, input.proposalId);
  if (!claimed.ok) {
    return {
      ok: false,
      error:
        claimed.reason ||
        "Another confirmation attempt is already in progress for this booking.",
      unknownOutcome: claimed.reason?.includes("unsettled") ?? false,
    };
  }

  const sendEmail = deps.sendEmail ?? sendNotificationEmail;
  const portalUrl = buildCustomerProposalPortalUrl(input.token);
  const email = buildBookingConfirmationEmail({
    businessName: input.businessName,
    businessLogoUrl: input.businessLogoUrl,
    businessTradeLabel: input.businessTradeLabel,
    customerName: input.customerName,
    portalUrl,
    title: input.title,
    jobSummary: input.jobSummary,
    proposalNumber: input.proposalNumber,
    plannedStartDate: input.plannedStartDate,
    plannedStartDateText: input.plannedStartDateText,
    plannedStartTime: input.plannedStartTime,
    estimatedDuration: input.estimatedDuration,
  });

  let sendResult: Awaited<ReturnType<typeof sendNotificationEmail>>;
  try {
    sendResult = await sendEmail({
      to,
      subject: email.subject,
      message: email.text,
      html: email.html,
      businessName: email.businessName,
      replyTo: input.contactEmail,
      ctaUrl: portalUrl,
      ctaLabel: "View booking",
    });
  } catch {
    await markBookingConfirmOutcome(supabase, input.proposalId, {
      status: "unknown",
      provider: "resend",
      messageId: null,
      preserveAttemptAt: true,
    });
    return {
      ok: false,
      unknownOutcome: true,
      error: BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY,
    };
  }

  if (!sendResult.ok) {
    // Known non-acceptance from the provider (or local outbound block).
    await markBookingConfirmOutcome(supabase, input.proposalId, {
      status: "failed",
      provider: "resend",
      messageId: null,
    });
    return {
      ok: false,
      providerAccepted: false,
      error: sendResult.error || "Booking confirmation email could not be sent.",
    };
  }

  const persisted = await markBookingConfirmOutcome(supabase, input.proposalId, {
    status: "sent",
    provider: "resend",
    messageId: sendResult.messageId,
  });

  if (!persisted.ok) {
    await markBookingConfirmOutcome(supabase, input.proposalId, {
      status: "unknown",
      provider: "resend",
      messageId: sendResult.messageId,
      preserveAttemptAt: true,
    });
    return {
      ok: false,
      providerAccepted: true,
      unknownOutcome: true,
      messageId: sendResult.messageId,
      error:
        "The email provider accepted the booking confirmation, but Reanvil could not store the outcome. Do not resend. Record or confirm the provider message id without sending again.",
    };
  }

  return {
    ok: true,
    providerAccepted: true,
    messageId: sendResult.messageId,
  };
}

/** CAS claim: only one in-flight booking-confirmation send at a time. */
async function claimBookingConfirmSend(
  supabase: SupabaseClient,
  proposalId: string
): Promise<{ ok: true } | { ok: false; reason?: string }> {
  const { data, error } = await supabase
    .from("proposals")
    .update({
      booking_confirm_status: "unknown",
      booking_confirm_attempt_at: new Date().toISOString(),
      booking_confirm_attempt_provider: "resend",
      booking_confirm_attempt_message_id: null,
    })
    .eq("id", proposalId)
    .eq("status", "booked")
    .in("booking_confirm_status", ["needed", "failed"])
    .select("id");

  if (error) {
    return { ok: false, reason: "Could not start the confirmation send." };
  }
  if (data && data.length > 0) {
    return { ok: true };
  }

  const { data: row } = await supabase
    .from("proposals")
    .select("booking_confirm_status, booking_confirm_attempt_message_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (row?.booking_confirm_status === "sent") {
    return { ok: false, reason: "Booking confirmation was already recorded as sent." };
  }
  if (row?.booking_confirm_status === "unknown") {
    return {
      ok: false,
      reason: row.booking_confirm_attempt_message_id
        ? "A previous confirmation attempt is unsettled. Use Confirm sent without resending."
        : BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY,
    };
  }
  return { ok: false, reason: "No failed booking confirmation is waiting to send." };
}

async function markBookingConfirmOutcome(
  supabase: SupabaseClient,
  proposalId: string,
  input: {
    status: Exclude<BookingConfirmStatus, null>;
    provider: string;
    messageId: string | null;
    preserveAttemptAt?: boolean;
  }
): Promise<{ ok: boolean }> {
  const patch: Record<string, unknown> = {
    booking_confirm_status: input.status,
    booking_confirm_attempt_provider: input.provider,
    booking_confirm_attempt_message_id: input.messageId,
  };
  if (!input.preserveAttemptAt) {
    patch.booking_confirm_attempt_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("proposals")
    .update(patch)
    .eq("id", proposalId)
    .eq("status", "booked")
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false };
  }
  return { ok: true };
}

/** Trader retry after a known failed booking confirmation (or never-sent needed). */
export async function retryBookingConfirmationEmail(
  _prev: BookingConfirmNotifyState,
  formData: FormData
): Promise<BookingConfirmNotifyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = String(formData.get("proposalId") ?? "").trim();
  if (!proposalId) return { error: "Proposal not found." };

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, customer_email, customer_name, customer_access_token, title, job_summary, proposal_number, planned_start_date, planned_start_date_text, planned_start_time, estimated_duration, booking_confirm_status, booking_confirm_attempt_message_id, accepted_content_revision, accepted_total_amount"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (error || !proposal) return { error: "Proposal not found." };
  if (proposal.status !== "booked") {
    return { error: "Only accepted bookings can retry confirmation email." };
  }

  const status = proposal.booking_confirm_status;
  if (status === "sent") {
    return { ok: true, providerAccepted: true };
  }
  if (status === "unknown") {
    return {
      error: BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY,
      unknownOutcome: true,
      messageId: proposal.booking_confirm_attempt_message_id || undefined,
    };
  }
  if (status !== "failed" && status !== "needed") {
    return { error: "No failed booking confirmation is waiting to retry." };
  }

  const to = String(proposal.customer_email || "").trim();
  if (!to) return { error: "No customer email is saved for this booking." };
  const token = String(proposal.customer_access_token || "").trim();
  if (!token) return { error: "Customer portal token is missing." };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("business_name, trade_type, contact_email, logo_url")
    .eq("id", proposal.workspace_id)
    .maybeSingle();

  const result = await deliverBookingConfirmationEmail(supabase, {
    proposalId: proposal.id,
    workspaceId: proposal.workspace_id,
    token,
    to,
    businessName: workspace?.business_name ?? null,
    businessLogoUrl: loadWorkspaceEmailLogoUrl({
      logo_url: workspace?.logo_url ?? null,
    }),
    businessTradeLabel: workspace?.trade_type,
    contactEmail: workspace?.contact_email,
    customerName: proposal.customer_name,
    title: proposal.title,
    jobSummary: proposal.job_summary,
    proposalNumber: proposal.proposal_number,
    plannedStartDate: proposal.planned_start_date,
    plannedStartDateText: proposal.planned_start_date_text,
    plannedStartTime: proposal.planned_start_time,
    estimatedDuration: proposal.estimated_duration,
  });

  revalidatePath(`/proposals/${proposalId}`);
  return result;
}

/**
 * Stage 2M: unknown must NOT become retryable via trader opinion.
 * Kept as an explicit refusal so old UI forms cannot unlock blind resend.
 */
export async function markBookingConfirmationFailedForRetry(
  _prev: BookingConfirmNotifyState,
  formData: FormData
): Promise<BookingConfirmNotifyState> {
  void formData;
  return {
    error: BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY,
    unknownOutcome: true,
  };
}

/**
 * Record a provider message id found during manual review — no resend.
 * Preserves original attempt timestamp.
 */
export async function confirmBookingConfirmationWithProviderId(
  _prev: BookingConfirmNotifyState,
  formData: FormData
): Promise<BookingConfirmNotifyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = String(formData.get("proposalId") ?? "").trim();
  const messageId = String(formData.get("messageId") ?? "").trim();
  if (!proposalId) return { error: "Proposal not found." };
  if (!messageId || messageId.length < 8) {
    return {
      error: "Enter the provider message id from the email dashboard.",
      unknownOutcome: true,
    };
  }

  const { data, error } = await supabase
    .from("proposals")
    .update({
      booking_confirm_status: "sent",
      booking_confirm_attempt_provider: "resend",
      booking_confirm_attempt_message_id: messageId,
      // Keep booking_confirm_attempt_at as original evidence.
    })
    .eq("id", proposalId)
    .eq("status", "booked")
    .eq("booking_confirm_status", "unknown")
    .select("id, booking_confirm_attempt_at");

  if (error || !data || data.length === 0) {
    return {
      error:
        "Could not record the provider id. Only unsettled confirmation attempts can be confirmed this way.",
      unknownOutcome: true,
    };
  }

  revalidatePath(`/proposals/${proposalId}`);
  return {
    ok: true,
    providerAccepted: true,
    messageId,
  };
}

/** Mark confirmation sent using a stored provider message id — no resend. */
export async function confirmBookingConfirmationWithoutResending(
  _prev: BookingConfirmNotifyState,
  formData: FormData
): Promise<BookingConfirmNotifyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = String(formData.get("proposalId") ?? "").trim();
  if (!proposalId) return { error: "Proposal not found." };

  const { data: proposal } = await supabase
    .from("proposals")
    .select(
      "id, status, booking_confirm_status, booking_confirm_attempt_message_id"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal || proposal.status !== "booked") {
    return { error: "Proposal not found." };
  }

  const messageId = String(
    proposal.booking_confirm_attempt_message_id || ""
  ).trim();
  if (!messageId) {
    return {
      error: BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY,
      unknownOutcome: true,
    };
  }

  const persisted = await markBookingConfirmOutcome(supabase, proposalId, {
    status: "sent",
    provider: "resend",
    messageId,
    preserveAttemptAt: true,
  });
  if (!persisted.ok) {
    return { error: "Could not confirm the booking notification outcome." };
  }

  revalidatePath(`/proposals/${proposalId}`);
  return { ok: true, providerAccepted: true, messageId };
}
