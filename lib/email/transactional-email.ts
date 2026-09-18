import { CUSTOMER_EMAIL_COLORS } from "@/lib/email/customer-email-tokens";
import {
  buildCustomerEmailCtaHtml,
  buildCustomerEmailFallbackHtml,
  buildCustomerEmailFooterHtml,
  buildCustomerEmailIdentityHtml,
  buildEmailHeadingRow,
  buildEmailIntroRow,
  buildEmailQuotedMessageCardHtml,
  buildEmailSummaryCardHtml,
  buildEmailSupportCardHtml,
  buildTraderEmailFooterHtml,
  buildTraderEmailIdentityHtml,
  customerEmailSafeHttpUrl,
  wrapCustomerEmailDocument,
  type EmailSummaryRow,
} from "@/lib/email/customer-email-shell";
import { resolveProposalEmailBusinessName } from "@/lib/email/proposal-email-presentation";
import { resolveCustomerFacingBusinessLogoUrl } from "@/lib/proposals/pdf/customer-branding";

export { CUSTOMER_EMAIL_COLORS as TRANSACTIONAL_EMAIL_COLORS };
export type { EmailSummaryRow };

export type TransactionalEmailAudience = "customer" | "trader";

export type TransactionalEmailContent = {
  audience: TransactionalEmailAudience;
  businessName?: string | null;
  logoUrl?: string | null;
  tradeLabel?: string | null;
  heading: string;
  greeting?: string | null;
  intro: string;
  summaryRows?: EmailSummaryRow[];
  quotedMessage?: string | null;
  regarding?: string | null;
  senderLabel?: string | null;
  accentBorder?: boolean;
  supportText?: string | null;
  ctaLabel: string;
  ctaUrl?: string | null;
  fallbackIntro?: string;
  fallbackLabel?: string;
  preheader: string;
  title?: string;
};

export type RenderedTransactionalEmail = {
  subject: string;
  html: string;
  text: string;
  businessName: string;
  ctaLabel: string;
  ctaUrl: string;
  heading: string;
  preheader: string;
  audience: TransactionalEmailAudience;
};

const VISIBLE_URL = /https?:\/\/\S+/gi;

export function stripVisibleEmailUrls(value: string): string {
  return value
    .replace(VISIBLE_URL, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function conciseEmailPreheader(value: string, max = 90): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "Open this Reanvil notification.";
  }
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function buildTransactionalEmailText(input: {
  greeting?: string | null;
  intro: string;
  summaryRows?: EmailSummaryRow[];
  quotedMessage?: string | null;
  regarding?: string | null;
  supportText?: string | null;
  ctaLabel: string;
  ctaUrl?: string | null;
}): string {
  const lines: string[] = [];
  if (input.greeting?.trim()) {
    lines.push(input.greeting.trim(), "");
  }
  lines.push(input.intro.trim());
  if (input.quotedMessage?.trim()) {
    lines.push("", input.quotedMessage.trim());
    if (input.regarding?.trim()) {
      lines.push(`Regarding: ${input.regarding.trim()}`);
    }
  }
  for (const row of input.summaryRows ?? []) {
    if (!row.value.trim()) {
      continue;
    }
    lines.push("", row.label, row.value.trim());
  }
  if (input.supportText?.trim()) {
    lines.push("", input.supportText.trim());
  }
  const ctaUrl = input.ctaUrl?.trim() ?? "";
  if (ctaUrl) {
    lines.push("", `${input.ctaLabel}:`, ctaUrl);
  }
  return lines.join("\n");
}

/**
 * Shared Reanvil transactional email. Event senders supply content only.
 * New emails should call this instead of writing their own HTML shell.
 */
export function renderTransactionalEmail(
  input: TransactionalEmailContent
): string {
  const audience = input.audience;
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const logoUrl = resolveCustomerFacingBusinessLogoUrl(input.logoUrl);
  const portalUrl = customerEmailSafeHttpUrl(input.ctaUrl);
  const intro = stripVisibleEmailUrls(input.intro);
  const heading = input.heading.trim() || "Notification";
  const preheader = conciseEmailPreheader(input.preheader);
  const fallbackLabel =
    input.fallbackLabel?.trim() ||
    (audience === "trader" ? "Open in Reanvil" : "Open secure portal");
  const fallbackIntro =
    input.fallbackIntro?.trim() ||
    (audience === "trader"
      ? "If the button doesn't work, open Reanvil below:"
      : "If the button doesn't work, you can open your secure portal below:");

  const identity =
    audience === "trader"
      ? buildTraderEmailIdentityHtml()
      : buildCustomerEmailIdentityHtml({
          businessName,
          logoUrl,
          tradeLabel: input.tradeLabel?.trim() || null,
        });

  const innerRows = `${identity}
          ${buildEmailHeadingRow(heading)}
          ${buildEmailIntroRow(input.greeting, intro)}
          ${
            input.quotedMessage?.trim()
              ? buildEmailQuotedMessageCardHtml({
                  message: input.quotedMessage,
                  regarding: input.regarding,
                  senderLabel: input.senderLabel,
                })
              : buildEmailSummaryCardHtml({
                  rows: input.summaryRows ?? [],
                  accentBorder: input.accentBorder,
                })
          }
          <tr>
            <td>${buildCustomerEmailCtaHtml({
              portalUrl,
              ctaLabel: input.ctaLabel,
            })}</td>
          </tr>
          ${buildEmailSupportCardHtml(input.supportText)}
          <tr>
            <td align="center" style="padding:4px 12px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="1" style="height:1px;line-height:1px;font-size:0;background:${CUSTOMER_EMAIL_COLORS.divider};">&nbsp;</td>
                </tr>
              </table>
              <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
              ${buildCustomerEmailFallbackHtml({
                portalUrl,
                intro: fallbackIntro,
                label: fallbackLabel,
              })}
            </td>
          </tr>
          ${
            audience === "trader"
              ? buildTraderEmailFooterHtml()
              : buildCustomerEmailFooterHtml()
          }`;

  return wrapCustomerEmailDocument({
    title: input.title?.trim() || heading,
    preheader,
    innerRows,
  });
}

export function renderCustomerEmail(
  input: Omit<TransactionalEmailContent, "audience">
): string {
  return renderTransactionalEmail({ ...input, audience: "customer" });
}

export function renderTraderEmail(
  input: Omit<TransactionalEmailContent, "audience">
): string {
  return renderTransactionalEmail({ ...input, audience: "trader" });
}

export function assembleTransactionalEmail(input: {
  subject: string;
  content: TransactionalEmailContent;
}): RenderedTransactionalEmail {
  const businessName =
    resolveProposalEmailBusinessName(input.content.businessName) || "Reanvil";
  return {
    subject: input.subject,
    html: renderTransactionalEmail(input.content),
    text: buildTransactionalEmailText({
      greeting: input.content.greeting,
      intro: input.content.intro,
      summaryRows: input.content.summaryRows,
      quotedMessage: input.content.quotedMessage,
      regarding: input.content.regarding,
      supportText: input.content.supportText,
      ctaLabel: input.content.ctaLabel,
      ctaUrl: input.content.ctaUrl,
    }),
    businessName,
    ctaLabel: input.content.ctaLabel,
    ctaUrl: input.content.ctaUrl?.trim() || "",
    heading: input.content.heading,
    preheader: conciseEmailPreheader(input.content.preheader),
    audience: input.content.audience,
  };
}
