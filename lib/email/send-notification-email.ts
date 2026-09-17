import { Resend } from "resend";
import {
  assembleTransactionalEmail,
  renderTransactionalEmail,
  type TransactionalEmailAudience,
  type TransactionalEmailContent,
} from "@/lib/email/transactional-email";

export type SendNotificationEmailInput = {
  to: string;
  subject: string;
  message: string;
  businessName: string;
  replyTo?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  heading?: string | null;
  preheader?: string | null;
  audience?: TransactionalEmailAudience;
  /** When set, send this already-rendered shared-shell HTML. */
  html?: string | null;
  content?: TransactionalEmailContent | null;
};

export type SendNotificationEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

function getFromAddress(businessName: string): string | null {
  const configuredFrom = process.env.RESEND_FROM_EMAIL?.trim();
  if (configuredFrom) {
    return configuredFrom;
  }
  if (!businessName.trim()) {
    return null;
  }
  return `${businessName} <onboarding@resend.dev>`;
}

function fallbackContent(
  input: SendNotificationEmailInput
): TransactionalEmailContent {
  return {
    audience: input.audience ?? "customer",
    businessName: input.businessName,
    heading: input.heading?.trim() || input.subject,
    intro: input.message,
    ctaLabel: input.ctaLabel?.trim() || "Open secure portal",
    ctaUrl: input.ctaUrl,
    preheader:
      input.preheader?.trim() || "You have a new Reanvil notification.",
  };
}

/** Shared dark Reanvil HTML for every notification send path. */
export function buildNotificationHtml(input: SendNotificationEmailInput): string {
  if (input.html?.trim()) {
    return input.html.trim();
  }
  if (input.content) {
    return renderTransactionalEmail(input.content);
  }
  return renderTransactionalEmail(fallbackContent(input));
}

function buildNotificationText(input: SendNotificationEmailInput): string {
  const ctaUrl = input.ctaUrl?.trim() || "";
  if (input.html || input.content || !ctaUrl || input.message.includes(ctaUrl)) {
    return input.message;
  }
  return `${input.message}\n\n${input.ctaLabel?.trim() || "Open conversation"}:\n${ctaUrl}`;
}

/** Lightweight notification email — no PDF attachment. Always uses the dark shell. */
export async function sendNotificationEmail(
  input: SendNotificationEmailInput
): Promise<SendNotificationEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false,
      error: "Email sending is not configured.",
    };
  }

  const from = getFromAddress(input.businessName);
  if (!from) {
    return {
      ok: false,
      error: "Email sending is not configured.",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      replyTo: input.replyTo?.trim() || undefined,
      subject: input.subject,
      text: buildNotificationText(input),
      html: buildNotificationHtml(input),
    });

    if (error || !data?.id) {
      return {
        ok: false,
        error: error?.message || "Email couldn't be sent.",
      };
    }

    return { ok: true, messageId: data.id };
  } catch (error) {
    console.error("Notification email failed:", error);
    return { ok: false, error: "Email couldn't be sent." };
  }
}

export function previewNotificationEmail(input: SendNotificationEmailInput) {
  if (input.content) {
    return assembleTransactionalEmail({
      subject: input.subject,
      content: input.content,
    });
  }
  return assembleTransactionalEmail({
    subject: input.subject,
    content: fallbackContent(input),
  });
}
