import { Resend } from "resend";

export type SendNotificationEmailInput = {
  to: string;
  subject: string;
  message: string;
  businessName: string;
  replyTo?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlEmail(input: SendNotificationEmailInput): string {
  const body = escapeHtml(input.message).replaceAll("\n", "<br />");
  const ctaUrl = input.ctaUrl?.trim();
  const ctaLabel = input.ctaLabel?.trim() || "Open conversation";

  const button = ctaUrl
    ? `<div style="margin: 28px 0 8px;">
  <a href="${escapeHtml(ctaUrl)}"
     style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:600;font-size:15px;">
    ${escapeHtml(ctaLabel)}
  </a>
</div>
<p style="margin:0 0 24px;font-size:13px;color:#555555;">
  Or paste this link into your browser:<br />
  <a href="${escapeHtml(ctaUrl)}" style="color:#111111;">${escapeHtml(ctaUrl)}</a>
</p>`
    : "";

  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #111111;">${body}${button}</div>`;
}

/** Lightweight notification email — no PDF attachment. */
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
      text: [
        input.message,
        input.ctaUrl?.trim()
          ? `\n\n${input.ctaLabel?.trim() || "Open conversation"}:\n${input.ctaUrl.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join(""),
      html: buildHtmlEmail(input),
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
