import {
  buildCustomerEmailCtaHtml,
  buildCustomerEmailFallbackHtml,
  buildCustomerEmailFooterHtml,
  buildCustomerEmailIdentityHtml,
  customerEmailDetailRow,
  customerEmailIconCell,
  customerEmailSafeHttpUrl,
  customerEmailTextStyle,
  escapeCustomerEmailHtml,
  wrapCustomerEmailDocument,
} from "@/lib/email/customer-email-shell";
import {
  buildProposalEmailGreeting,
  buildProposalEmailIntro,
  isUsableEmailValue,
  proposalEmailFirstName,
  resolveProposalEmailBusinessName,
  resolveProposalEmailTradeLabel,
} from "@/lib/email/proposal-email-presentation";
import {
  PROPOSAL_EMAIL_COLORS as C,
  PROPOSAL_EMAIL_CTA_LABEL,
  PROPOSAL_EMAIL_FALLBACK_LINK_LABEL,
  PROPOSAL_EMAIL_HEADING,
  PROPOSAL_EMAIL_PREHEADER,
} from "@/lib/email/proposal-email-tokens";
import { resolveCustomerFacingBusinessLogoUrl } from "@/lib/proposals/pdf/customer-branding";

export type ProposalEmailHtmlInput = {
  businessName: string;
  businessLogoUrl?: string | null;
  businessTradeLabel?: string | null;
  customerName?: string | null;
  portalUrl: string;
  ctaLabel?: string | null;
  title?: string | null;
  jobSubtitle?: string | null;
  priceLabel?: string | null;
  proposedDateLabel?: string | null;
  durationLabel?: string | null;
  scopeSummary?: string | null;
  /** @deprecated Kept so older callers still compile. Never dumped into HTML. */
  introHtml?: string | null;
  pdfUrl?: string | null;
};

function proposalEmailJobIconSymbol(title: string): string {
  const lower = title.toLowerCase();
  if (/bathroom|plumb|shower|toilet/.test(lower)) {
    return "◈";
  }
  if (/kitchen/.test(lower)) {
    return "▣";
  }
  if (/electric|rewire|socket/.test(lower)) {
    return "⌁";
  }
  if (/garden|landscape|driveway|patio|pave/.test(lower)) {
    return "⌂";
  }
  if (/paint|decorat/.test(lower)) {
    return "✎";
  }
  return "▣";
}

function summaryRow(value: string): string {
  if (!isUsableEmailValue(value)) {
    return "";
  }
  return `<tr>
  ${customerEmailIconCell("≡")}
  <td valign="top" style="padding:0 0 4px;">
    <p style="margin:0 0 3px;${customerEmailTextStyle(C.muted, "font-size:13px;line-height:1.35;")}">Summary</p>
    <p style="margin:0;${customerEmailTextStyle(C.text, "font-size:15px;line-height:1.5;font-weight:500;")}">${escapeCustomerEmailHtml(value)}</p>
  </td>
</tr>`;
}

/**
 * Email-safe HTML for the customer proposal notification.
 * Tables + inline colours only. Matches the approved dark Reanvil design.
 */
export function buildProposalEmailHtml(input: ProposalEmailHtmlInput): string {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const portalUrl = customerEmailSafeHttpUrl(input.portalUrl);
  const logoUrl = resolveCustomerFacingBusinessLogoUrl(input.businessLogoUrl);
  const tradeLabel = resolveProposalEmailTradeLabel(
    input.businessTradeLabel,
    businessName
  );
  const firstName = proposalEmailFirstName(input.customerName);
  const ctaLabel = input.ctaLabel?.trim() || PROPOSAL_EMAIL_CTA_LABEL;
  const title = input.title?.trim() || "Your proposal";
  const subtitle = isUsableEmailValue(input.jobSubtitle)
    ? input.jobSubtitle.trim()
    : "";
  const priceLabel = isUsableEmailValue(input.priceLabel)
    ? input.priceLabel.trim()
    : "";
  const proposedDateLabel = isUsableEmailValue(input.proposedDateLabel)
    ? input.proposedDateLabel.trim()
    : "";
  const durationLabel = isUsableEmailValue(input.durationLabel)
    ? input.durationLabel.trim()
    : "";
  const scopeSummary = isUsableEmailValue(input.scopeSummary)
    ? input.scopeSummary.trim()
    : "";
  const greeting = buildProposalEmailGreeting(firstName);
  const intro = buildProposalEmailIntro(title);

  const identity = buildCustomerEmailIdentityHtml({
    businessName,
    logoUrl,
    tradeLabel,
  });
  const cta = buildCustomerEmailCtaHtml({ portalUrl, ctaLabel });
  const fallbackLink = buildCustomerEmailFallbackHtml({
    portalUrl,
    intro: "If the button doesn't work, you can open your secure proposal link below:",
    label: PROPOSAL_EMAIL_FALLBACK_LINK_LABEL,
  });

  const innerRows = `${identity}
          <tr>
            <td align="center" style="padding:0 8px 10px;">
              <h1 class="email-text" style="margin:0;${customerEmailTextStyle(C.text, "font-size:30px;line-height:1.2;font-weight:800;")}">${PROPOSAL_EMAIL_HEADING}</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 12px 28px;">
              <p class="email-muted" style="margin:0 0 8px;${customerEmailTextStyle(C.muted, "font-size:16px;line-height:1.4;")}">${escapeCustomerEmailHtml(greeting)}</p>
              <p class="email-muted" style="margin:0;${customerEmailTextStyle(C.muted, "font-size:15px;line-height:1.55;")}">${escapeCustomerEmailHtml(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="width:100%;background:${C.card};border:2px solid ${C.accent};border-radius:16px;">
                <tr>
                  <td style="padding:22px 20px 18px;background:${C.card};border-radius:16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        ${customerEmailIconCell(proposalEmailJobIconSymbol(title), 48)}
                        <td valign="top" style="padding:0 0 16px;">
                          <p class="email-text" style="margin:0;${customerEmailTextStyle(C.text, "font-size:20px;line-height:1.3;font-weight:700;")}">${escapeCustomerEmailHtml(title)}</p>
                          ${
                            subtitle
                              ? `<p class="email-muted" style="margin:4px 0 0;${customerEmailTextStyle(C.muted, "font-size:14px;line-height:1.4;")}">${escapeCustomerEmailHtml(subtitle)}</p>`
                              : ""
                          }
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding:0 0 16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td height="1" style="height:1px;line-height:1px;font-size:0;background:${C.divider};border:0;">&nbsp;</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${customerEmailDetailRow("£", "Total price", priceLabel, "20px")}
                      ${customerEmailDetailRow("▣", "Proposed start date", proposedDateLabel)}
                      ${customerEmailDetailRow("◷", "Estimated duration", durationLabel)}
                      ${summaryRow(scopeSummary)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>${cta}</td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cardPdf}" style="width:100%;background:${C.cardPdf};border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;background:${C.cardPdf};border-radius:14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        ${customerEmailIconCell("📎")}
                        <td valign="middle" style="padding:0 0 0;">
                          <p class="email-text" style="margin:0 0 3px;${customerEmailTextStyle(C.text, "font-size:15px;line-height:1.4;font-weight:600;")}">A PDF copy is attached for your records.</p>
                          <p class="email-muted" style="margin:0;${customerEmailTextStyle(C.muted, "font-size:13px;line-height:1.4;")}">You can also download it from the portal.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:4px 12px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="1" style="height:1px;line-height:1px;font-size:0;background:${C.divider};">&nbsp;</td>
                </tr>
              </table>
              <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
              ${fallbackLink}
            </td>
          </tr>
          ${buildCustomerEmailFooterHtml()}`;

  return wrapCustomerEmailDocument({
    title: PROPOSAL_EMAIL_HEADING,
    preheader: PROPOSAL_EMAIL_PREHEADER,
    innerRows,
  });
}

export function proposalEmailIntroHtml(message: string): string {
  return escapeCustomerEmailHtml(message).replaceAll("\n", "<br />");
}
