import { normalizeProposalStatus } from "@/lib/proposals/status";
import {
  buildSendProposalMessage,
  buildSendProposalSubject,
} from "@/lib/proposals/send-proposal-defaults";

export type ProposalEmailProviderResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export function canSendProposalEmail(status: string): boolean {
  const normalized = normalizeProposalStatus(status);
  return (
    normalized === "ready_to_send" ||
    normalized === "needs_attention" ||
    normalized === "waiting_for_customer"
  );
}

export type ProposalEmailSendKind = "first_send" | "revised" | "reminder";

export function canResendProposalEmail(status: string): boolean {
  const normalized = normalizeProposalStatus(status);
  return (
    normalized === "needs_attention" || normalized === "waiting_for_customer"
  );
}

export function canResendWaitingProposal(status: string): boolean {
  return normalizeProposalStatus(status) === "waiting_for_customer";
}

export function resolveProposalEmailSendKind(
  status: string,
  explicit?: ProposalEmailSendKind
): ProposalEmailSendKind {
  if (explicit) {
    return explicit;
  }
  const normalized = normalizeProposalStatus(status);
  if (normalized === "needs_attention") {
    return "revised";
  }
  if (normalized === "waiting_for_customer") {
    return "reminder";
  }
  return "first_send";
}

/** Reminder resend only refreshes sent_at. It must not create jobs or dates. */
export function reminderResendSideEffects() {
  return {
    createsProposal: false,
    createsJob: false,
    writesCalendar: false,
    rotatesPortalToken: false,
    changesProposalContent: false,
    nextStatus: "waiting_for_customer" as const,
    touchedFields: ["sent_at"] as const,
    preservedFields: [
      "status",
      "accepted_at",
      "booking_confirmation",
      "planned_start_date",
      "planned_start_time",
      "customer_access_token",
      "job_summary",
      "total_amount",
    ] as const,
  };
}

export function isRevisedProposalSend(status: string): boolean {
  return resolveProposalEmailSendKind(status) === "revised";
}

/**
 * Status moving to waiting_for_customer is not proof the email sent.
 * Only call this after the email provider confirms success + message id.
 */
export function completeProposalEmailDelivery(
  providerResult: ProposalEmailProviderResult
):
  | { sent: true; messageId: string }
  | { sent: false; error: string } {
  if (!providerResult.ok) {
    return {
      sent: false,
      error: providerResult.error || "Email couldn't be sent. Please try again.",
    };
  }

  const messageId = providerResult.messageId?.trim() || "";
  if (!messageId) {
    return {
      sent: false,
      error: "Email couldn't be sent. The provider did not confirm delivery.",
    };
  }

  return { sent: true, messageId };
}

export function buildProposalEmailCopy(input: {
  customerName: string | null;
  businessName: string;
  portalUrl: string;
  revised?: boolean;
  kind?: ProposalEmailSendKind;
}): { subject: string; message: string } {
  const name = input.customerName?.trim() || "there";
  const business = input.businessName.trim() || "Your business";
  const kind =
    input.kind ?? (input.revised ? "revised" : "first_send");

  if (kind === "reminder") {
    return {
      subject: `Your Reanvil proposal – ${input.customerName?.trim() || "your proposal"}`,
      message: `Hi ${name},

Here is your proposal again. You can review it online and respond without creating an account.

View & respond to your proposal:
${input.portalUrl}

A PDF copy is also attached for your records.

Kind regards,
${business}`,
    };
  }

  if (kind !== "revised") {
    return {
      subject: buildSendProposalSubject(input.customerName?.trim() || name),
      message: buildSendProposalMessage(name, business, input.portalUrl),
    };
  }

  return {
    subject: `Your updated Reanvil proposal – ${input.customerName?.trim() || "your proposal"}`,
    message: `Hi ${name},

Please find your updated proposal. You can review the latest version online and respond without creating an account.

View & respond to your proposal:
${input.portalUrl}

A PDF copy is also attached for your records.

Kind regards,
${business}`,
  };
}

export function buildProposalEmailEvent(input: {
  recipientEmail: string;
  subject: string;
  senderName: string;
  messageId: string;
  portalUrl: string;
  revised?: boolean;
  kind?: ProposalEmailSendKind;
}): {
  eventType: "emailed";
  note: string;
  metadata: Record<string, unknown>;
} {
  const kind =
    input.kind ?? (input.revised ? "revised" : "first_send");
  const note =
    kind === "reminder"
      ? "Proposal resent"
      : kind === "revised"
        ? `Revised proposal emailed to ${input.recipientEmail}`
        : `Proposal emailed to ${input.recipientEmail}`;

  return {
    eventType: "emailed",
    note,
    metadata: {
      recipient_email: input.recipientEmail,
      subject: input.subject,
      sender_name: input.senderName,
      provider: "resend",
      provider_message_id: input.messageId,
      portal_url: input.portalUrl,
      attached_pdf: true,
      send_kind: kind,
    },
  };
}

export function shouldRecordProposalSent(sent: boolean): boolean {
  return sent;
}

export async function invokeProposalEmailProvider(
  sendEmail: (input: {
    to: string;
    subject: string;
    message: string;
    pdfBuffer: Buffer;
    ctaUrl?: string | null;
  }) => Promise<ProposalEmailProviderResult>,
  input: {
    to: string;
    subject: string;
    message: string;
    pdfBuffer: Buffer;
    portalUrl: string;
  }
): Promise<
  | { sent: true; messageId: string }
  | { sent: false; error: string }
> {
  const providerResult = await sendEmail({
    to: input.to,
    subject: input.subject,
    message: input.message,
    pdfBuffer: input.pdfBuffer,
    ctaUrl: input.portalUrl,
  });
  return completeProposalEmailDelivery(providerResult);
}
