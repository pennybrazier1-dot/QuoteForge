import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import {
  buildCustomerReplyEmail,
  buildTraderActivityEmail,
  customerConversationUrl,
  traderActivityEventFromKindLabel,
  traderConversationUrl,
} from "@/lib/email/transactional-events";

export function buildTraderConversationUrl(proposalId: string): string {
  return traderConversationUrl(proposalId);
}

export function buildCustomerConversationUrl(token: string): string {
  return customerConversationUrl(token);
}

export function buildCustomerReplyNotification(input: {
  businessName: string | null | undefined;
  customerName: string | null | undefined;
  preview: string;
  portalToken: string;
  logoUrl?: string | null;
  tradeLabel?: string | null;
}) {
  const email = buildCustomerReplyEmail(input);
  return {
    subject: email.subject,
    message: email.text,
    businessName: email.businessName,
    ctaUrl: email.ctaUrl,
    ctaLabel: email.ctaLabel,
    html: email.html,
    heading: email.heading,
    preheader: email.preheader,
    audience: email.audience,
  };
}

export function buildTraderMessageNotification(input: {
  businessName: string | null | undefined;
  customerName: string | null | undefined;
  proposalNumber: string;
  preview: string;
  proposalId: string;
  kindLabel: string;
  jobTitle?: string | null;
}) {
  const email = buildTraderActivityEmail({
    event: traderActivityEventFromKindLabel(input.kindLabel),
    customerName: input.customerName,
    jobTitle: input.jobTitle,
    proposalNumber: input.proposalNumber,
    preview: input.preview,
    proposalId: input.proposalId,
  });
  return {
    subject: email.subject,
    message: email.text,
    businessName: email.businessName,
    ctaUrl: email.ctaUrl,
    ctaLabel: email.ctaLabel,
    html: email.html,
    heading: email.heading,
    preheader: email.preheader,
    audience: email.audience,
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
  html?: string | null;
  heading?: string;
  preheader?: string;
  audience?: "customer" | "trader";
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
    html: input.html,
    heading: input.heading,
    preheader: input.preheader,
    audience: input.audience,
  });

  if (!result.ok) {
    console.warn("[conversation-notify]", result.error);
  }
}
