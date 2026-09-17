import { Resend } from "resend";
import { buildProposalEmailHtml } from "@/lib/email/proposal-email-html";
import { PROPOSAL_EMAIL_CTA_LABEL } from "@/lib/email/proposal-email-tokens";

export type SendProposalEmailInput = {
  to: string;
  subject: string;
  message: string;
  pdfBuffer: Buffer;
  replyTo?: string | null;
  businessName: string;
  businessLogoUrl?: string | null;
  /** Secure customer portal URL shown as primary CTA in HTML email. */
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  pdfUrl?: string | null;
  customerName?: string | null;
  title?: string | null;
  jobSubtitle?: string | null;
  priceLabel?: string | null;
  proposedDateLabel?: string | null;
  durationLabel?: string | null;
  scopeSummary?: string | null;
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

  const fromName = businessName.trim() || "Proposal";
  return `${fromName} <onboarding@resend.dev>`;
}

/** Single HTML template for Send and Resend. */
export function buildHtmlEmail(input: SendProposalEmailInput): string {
  return buildProposalEmailHtml({
    businessName: input.businessName,
    businessLogoUrl: input.businessLogoUrl,
    customerName: input.customerName,
    portalUrl: input.ctaUrl || "",
    pdfUrl: input.pdfUrl,
    ctaLabel: input.ctaLabel?.trim() || PROPOSAL_EMAIL_CTA_LABEL,
    title: input.title,
    jobSubtitle: input.jobSubtitle,
    priceLabel: input.priceLabel,
    proposedDateLabel: input.proposedDateLabel,
    durationLabel: input.durationLabel,
    scopeSummary: input.scopeSummary,
  });
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
      html: buildHtmlEmail(input),
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
