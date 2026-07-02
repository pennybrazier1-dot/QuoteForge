import { Resend } from "resend";

export type SendProposalEmailInput = {
  to: string;
  subject: string;
  message: string;
  pdfBuffer: Buffer;
  replyTo?: string | null;
  businessName: string;
};

export type SendProposalEmailResult =
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

function toHtmlBody(message: string): string {
  return escapeHtml(message).replaceAll("\n", "<br />");
}

export async function sendProposalEmail(
  input: SendProposalEmailInput
): Promise<SendProposalEmailResult> {
  const resend = getResendClient();

  if (!resend) {
    return {
      ok: false,
      error: "Email sending is not configured. Add RESEND_API_KEY to your environment.",
    };
  }

  const from = getFromAddress(input.businessName);

  if (!from) {
    return {
      ok: false,
      error: "Email sending is not configured. Add RESEND_FROM_EMAIL to your environment.",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      replyTo: input.replyTo?.trim() || undefined,
      subject: input.subject,
      text: input.message,
      html: `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #111111;">${toHtmlBody(input.message)}</div>`,
      attachments: [
        {
          filename: "Proposal.pdf",
          content: input.pdfBuffer,
        },
      ],
    });

    if (error) {
      return {
        ok: false,
        error: error.message || "Email couldn't be sent. Please try again.",
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        error: "Email couldn't be sent. Please try again.",
      };
    }

    return { ok: true, messageId: data.id };
  } catch (error) {
    console.error("Resend send failed:", error);
    return {
      ok: false,
      error: "Email couldn't be sent. Please try again.",
    };
  }
}
