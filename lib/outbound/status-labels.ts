import type { OutboundEventKind, OutboundStatus } from "@/lib/outbound/types";
import { OUTBOUND_PROVIDER_ACCEPTED_NOTE } from "@/lib/outbound/types";

export function outboundStatusLabel(status: OutboundStatus): string {
  switch (status) {
    case "needed":
      return "Email not sent yet";
    case "sending":
      return "Send in progress";
    case "provider_accepted":
      return "Provider accepted";
    case "failed":
      return "Email failed";
    case "unknown":
      return "Unsettled — review required";
    case "simulated":
      return "Simulated (no email sent)";
    default:
      return "Unknown status";
  }
}

export function outboundStatusDetail(status: OutboundStatus): string {
  switch (status) {
    case "needed":
      return "The notification is waiting to be sent.";
    case "sending":
      return "A send attempt is in progress. If this stays stuck, it will be marked unsettled for review.";
    case "provider_accepted":
      return OUTBOUND_PROVIDER_ACCEPTED_NOTE;
    case "failed":
      return "The provider refused or blocked this send. You can safely retry.";
    case "unknown":
      return "The outcome is uncertain. Do not resend. Confirm the provider message id without sending again.";
    case "simulated":
      return "Local labelled simulation only — Resend was not called.";
    default:
      return "";
  }
}

/** Event-aware titles so cancellation / credit-note notices are not mistaken for invoice emails. */
export function outboundEventStatusLabel(
  eventKind: OutboundEventKind | string | null | undefined,
  status: OutboundStatus
): string {
  if (eventKind === "invoice_cancelled") {
    switch (status) {
      case "needed":
        return "Cancellation email pending";
      case "sending":
        return "Cancellation email sending";
      case "failed":
        return "Cancellation email failed";
      case "unknown":
        return "Cancellation email unsettled — review required";
      case "provider_accepted":
        return "Cancellation email — provider accepted";
      case "simulated":
        return "Cancellation email simulated (no email sent)";
      default:
        return outboundStatusLabel(status);
    }
  }
  if (eventKind === "credit_note_issued") {
    switch (status) {
      case "needed":
        return "Credit-note email pending";
      case "sending":
        return "Credit-note email sending";
      case "failed":
        return "Credit-note email failed — not delivered";
      case "unknown":
        return "Credit-note email unsettled — review required";
      case "provider_accepted":
        return "Credit-note email — provider accepted";
      case "simulated":
        return "Credit-note email simulated (no email sent)";
      default:
        return outboundStatusLabel(status);
    }
  }
  return outboundStatusLabel(status);
}

export function outboundEventStatusDetail(
  eventKind: OutboundEventKind | string | null | undefined,
  status: OutboundStatus
): string {
  if (eventKind === "invoice_cancelled") {
    switch (status) {
      case "needed":
        return "The invoice was cancelled in Reanvil. The customer cancellation notice is waiting to be sent.";
      case "failed":
        return "The invoice was cancelled, but the customer cancellation notice did not send. Retry when ready — do not treat this as delivered.";
      case "simulated":
        return "Local labelled simulation only — Resend was not called. Do not treat this as customer delivery.";
      case "provider_accepted":
        return OUTBOUND_PROVIDER_ACCEPTED_NOTE;
      default:
        return outboundStatusDetail(status);
    }
  }
  if (eventKind === "credit_note_issued") {
    switch (status) {
      case "needed":
        return "The credit-note email is waiting to be sent. It has not been delivered to the customer yet.";
      case "failed":
        return "The credit-note email did not send (including when LOCAL outbound is blocked). Retry when ready — do not treat this as delivered.";
      case "simulated":
        return "Local labelled simulation only — Resend was not called. Do not treat this as customer delivery.";
      case "provider_accepted":
        return OUTBOUND_PROVIDER_ACCEPTED_NOTE;
      default:
        return outboundStatusDetail(status);
    }
  }
  return outboundStatusDetail(status);
}

export function canRetryOutbound(status: OutboundStatus): boolean {
  return status === "needed" || status === "failed";
}

export function canConfirmOutboundWithoutResend(status: OutboundStatus): boolean {
  return status === "unknown";
}

/**
 * Honest labels for legacy quote/booking statuses (UI only — no schema change).
 * Never treat provider acceptance or business status as inbox delivery.
 */
export function legacyEmailOutcomeLabel(input: {
  provider?: string | null;
  simulated?: boolean | null;
  failed?: boolean | null;
  /** Legacy booking_confirm_status / outbound-like status when known. */
  status?: string | null;
}): string {
  if (input.failed || input.status === "failed") return "Email failed";
  if (input.status === "needed") return "Email not sent yet";
  if (input.status === "unknown") return "Unsettled — review required";
  if (
    input.simulated ||
    input.provider === "simulated" ||
    input.status === "simulated"
  ) {
    return "Simulated (no email sent)";
  }
  if (
    input.provider === "resend" ||
    input.status === "sent" ||
    input.status === "provider_accepted"
  ) {
    return "Provider accepted";
  }
  return "Email status unknown";
}

export function legacyEmailOutcomeDetail(input: {
  provider?: string | null;
  simulated?: boolean | null;
  failed?: boolean | null;
  status?: string | null;
}): string {
  const label = legacyEmailOutcomeLabel(input);
  if (label === "Email failed") {
    return outboundStatusDetail("failed");
  }
  if (label === "Email not sent yet") {
    return outboundStatusDetail("needed");
  }
  if (label === "Unsettled — review required") {
    return outboundStatusDetail("unknown");
  }
  if (label === "Simulated (no email sent)") {
    return outboundStatusDetail("simulated");
  }
  if (label === "Provider accepted") {
    return OUTBOUND_PROVIDER_ACCEPTED_NOTE;
  }
  return "This record does not have enough send evidence to show a stronger status.";
}

/**
 * Timeline / event presentation for proposal `emailed` status events.
 * Uses provider metadata only — never infers from waiting_for_customer / booked.
 */
export function proposalEmailedTimelineCopy(input: {
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  senderName?: string | null;
}): { label: string; description?: string } {
  const meta = input.metadata ?? {};
  const provider =
    typeof meta.provider === "string" ? meta.provider : null;
  const simulated =
    meta.simulated === true || provider === "simulated";
  const messageId =
    typeof meta.provider_message_id === "string"
      ? meta.provider_message_id.trim()
      : "";
  const sendKind =
    typeof meta.send_kind === "string" ? meta.send_kind : null;
  const isRevision =
    sendKind === "revised" ||
    Boolean(input.note?.toLowerCase().includes("revised"));
  const subject = isRevision ? "Revised proposal" : "Proposal";
  const byLine = input.senderName?.trim()
    ? `Recorded by ${input.senderName.trim()}`
    : undefined;

  if (simulated) {
    return {
      label: `${subject} simulated send — no email sent`,
      description: byLine,
    };
  }

  if (provider === "resend" && messageId) {
    return {
      label: `${subject} email — provider accepted`,
      description: byLine
        ? `${byLine}. ${OUTBOUND_PROVIDER_ACCEPTED_NOTE}`
        : OUTBOUND_PROVIDER_ACCEPTED_NOTE,
    };
  }

  if (provider === "resend" && !messageId) {
    return {
      label: `${subject} email — unsettled`,
      description: byLine
        ? `${byLine}. Provider acceptance is unclear; do not assume the customer received it.`
        : "Provider acceptance is unclear; do not assume the customer received it.",
    };
  }

  // Historic or incomplete evidence — stay neutral, do not guess.
  return {
    label: input.note?.trim()
      ? `${input.note.trim()} — email status unclear`
      : `${subject} email recorded — status unclear`,
    description: byLine
      ? `${byLine}. Insufficient send evidence on this record.`
      : "Insufficient send evidence on this record.",
  };
}
