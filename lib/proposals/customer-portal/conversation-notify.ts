import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import { getSiteUrl } from "@/lib/env/site-url";
import { buildCustomerProposalPortalUrl } from "@/lib/proposals/customer-portal/token";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";

export function buildTraderConversationUrl(proposalId: string): string {
  return `${getSiteUrl()}/proposals/${proposalId}#proposal-conversation`;
}

export function buildCustomerConversationUrl(token: string): string {
  return `${buildCustomerProposalPortalUrl(token)}#proposal-conversation`;
}

export function buildCustomerReplyNotification(input: {
  businessName: string | null | undefined;
  customerName: string | null | undefined;
  preview: string;
  portalToken: string;
}) {
  const businessName = resolveCustomerFacingBusinessName(input.businessName);
  const preview =
    input.preview.length > 220
      ? `${input.preview.slice(0, 217).trimEnd()}…`
      : input.preview;

  return {
    subject: `${businessName} replied to your proposal`,
    message: [
      `Hi${input.customerName ? ` ${input.customerName}` : ""},`,
      "",
      `${businessName} sent you a message about your proposal:`,
      "",
      `"${preview}"`,
      "",
      "Open the secure link below to read the full conversation and reply.",
    ].join("\n"),
    businessName,
    ctaUrl: buildCustomerConversationUrl(input.portalToken),
    ctaLabel: "View conversation",
  };
}

export function buildTraderMessageNotification(input: {
  businessName: string | null | undefined;
  customerName: string | null | undefined;
  proposalNumber: string;
  preview: string;
  proposalId: string;
  kindLabel: string;
}) {
  const businessName = resolveCustomerFacingBusinessName(input.businessName);
  const who = input.customerName?.trim() || "Your customer";
  const preview =
    input.preview.length > 220
      ? `${input.preview.slice(0, 217).trimEnd()}…`
      : input.preview;

  return {
    subject: `${who} messaged you on ${input.proposalNumber}`,
    message: [
      `${who} sent a ${input.kindLabel.toLowerCase()} on proposal ${input.proposalNumber}:`,
      "",
      `"${preview}"`,
      "",
      "Open Reanvil to view the conversation and reply.",
    ].join("\n"),
    businessName,
    ctaUrl: buildTraderConversationUrl(input.proposalId),
    ctaLabel: "Open conversation",
  };
}

/** Best-effort notification — never blocks the conversation action. */
export async function notifyConversationParticipant(input: {
  to: string | null | undefined;
  subject: string;
  message: string;
  businessName: string;
  ctaUrl: string;
  ctaLabel: string;
  replyTo?: string | null;
}): Promise<void> {
  const to = input.to?.trim();
  if (!to) {
    return;
  }

  const result = await sendNotificationEmail({
    to,
    subject: input.subject,
    message: input.message,
    businessName: input.businessName,
    ctaUrl: input.ctaUrl,
    ctaLabel: input.ctaLabel,
    replyTo: input.replyTo,
  });

  if (!result.ok) {
    console.warn("[conversation-notify]", result.error);
  }
}
