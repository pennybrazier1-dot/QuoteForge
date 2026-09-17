import {
  buildProposalEmailGreeting,
  buildProposalEmailIntro,
  isUsableEmailValue,
  proposalEmailFirstName,
  resolveProposalEmailBusinessName,
} from "@/lib/email/proposal-email-presentation";
import {
  PROPOSAL_EMAIL_COLORS as C,
  PROPOSAL_EMAIL_CTA_LABEL,
  PROPOSAL_EMAIL_FALLBACK_LINK_LABEL,
  PROPOSAL_EMAIL_HEADING,
} from "@/lib/email/proposal-email-tokens";
import { resolveCustomerFacingBusinessLogoUrl } from "@/lib/proposals/pdf/customer-branding";

export type ProposalEmailHtmlInput = {
  businessName: string;
  businessLogoUrl?: string | null;
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

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

function textStyle(color: string, extra = ""): string {
  return `font-family:${FONT};color:${color};-webkit-text-fill-color:${color};${extra}`;
}

function iconCell(symbol: string): string {
  return `<td width="36" valign="top" style="width:36px;padding:0 12px 18px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;border:1.5px solid ${C.accent};border-radius:14px;${textStyle(C.accent, "font-size:13px;line-height:28px;font-weight:600;")}">
        ${symbol}
      </td>
    </tr>
  </table>
</td>`;
}

function detailRow(
  symbol: string,
  label: string,
  value: string,
  valueSize = "17px"
): string {
  if (!isUsableEmailValue(value)) {
    return "";
  }
  return `<tr>
  ${iconCell(symbol)}
  <td valign="top" style="padding:0 0 18px;">
    <p style="margin:0 0 3px;${textStyle(C.muted, "font-size:13px;line-height:1.35;")}">${escapeHtml(label)}</p>
    <p style="margin:0;${textStyle(C.text, `font-size:${valueSize};line-height:1.4;font-weight:700;`)}">${escapeHtml(value)}</p>
  </td>
</tr>`;
}

function summaryRow(value: string): string {
  if (!isUsableEmailValue(value)) {
    return "";
  }
  return `<tr>
  ${iconCell("≡")}
  <td valign="top" style="padding:0 0 4px;">
    <p style="margin:0 0 3px;${textStyle(C.muted, "font-size:13px;line-height:1.35;")}">Summary</p>
    <p style="margin:0;${textStyle(C.text, "font-size:15px;line-height:1.5;font-weight:500;")}">${escapeHtml(value)}</p>
  </td>
</tr>`;
}

/**
 * Email-safe HTML for the customer proposal notification.
 * Tables + inline colours only. Matches the approved dark Reanvil design.
 */
export function buildProposalEmailHtml(input: ProposalEmailHtmlInput): string {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const portalUrl = safeHttpUrl(input.portalUrl);
  const logoUrl = resolveCustomerFacingBusinessLogoUrl(input.businessLogoUrl);
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

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(businessName || "")}" width="72" style="display:block;margin:0 auto 10px;border:0;max-width:160px;width:auto;height:auto;max-height:64px;" />`
    : "";

  const businessBlock = businessName
    ? `<p style="margin:0;${textStyle(C.text, "font-size:13px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;line-height:1.4;")}">${escapeHtml(businessName)}</p>`
    : "";

  const identity =
    logoBlock || businessBlock
      ? `<tr>
  <td align="center" style="padding:8px 8px 28px;">
    ${logoBlock}
    ${businessBlock}
  </td>
</tr>`
      : "";

  const cta = portalUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 20px;">
  <tr>
    <td align="center" bgcolor="${C.accent}" style="background:${C.accent};border-radius:14px;">
      <a href="${escapeHtml(portalUrl)}" style="display:block;padding:16px 20px;${textStyle(C.buttonText, "font-size:17px;line-height:1.2;font-weight:700;text-decoration:none;text-align:center;")}">
        ${escapeHtml(ctaLabel)}
      </a>
    </td>
  </tr>
</table>`
    : "";

  const fallbackLink = portalUrl
    ? `<p style="margin:0 0 8px;${textStyle(C.muted, "font-size:13px;line-height:1.5;")}">If the button doesn't work, you can open your secure proposal link below:</p>
<p style="margin:0;"><a href="${escapeHtml(portalUrl)}" style="${textStyle(C.accent, "font-size:15px;line-height:1.4;font-weight:700;text-decoration:none;")}">${PROPOSAL_EMAIL_FALLBACK_LINK_LABEL}</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(PROPOSAL_EMAIL_HEADING)}</title>
  <style type="text/css">
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, table, td, a, p { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    @media (prefers-color-scheme: dark) {
      .email-text { color:${C.text} !important; -webkit-text-fill-color:${C.text} !important; }
      .email-muted { color:${C.muted} !important; -webkit-text-fill-color:${C.muted} !important; }
    }
    @media only screen and (max-width: 620px) {
      .email-shell { width:100% !important; max-width:100% !important; }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">table,td,p,a,h1{font-family:Arial,Helvetica,sans-serif !important;}</style>
  <![endif]-->
</head>
<body class="email-text" style="margin:0;padding:0;background:${C.page};${textStyle(C.text)}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">
    ${escapeHtml(intro)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:28px 16px 32px;background:${C.page};">
        <table role="presentation" class="email-shell" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;">
          ${identity}
          <tr>
            <td align="center" style="padding:0 8px 10px;">
              <h1 class="email-text" style="margin:0;${textStyle(C.text, "font-size:30px;line-height:1.2;font-weight:800;")}">${PROPOSAL_EMAIL_HEADING}</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 12px 28px;">
              <p class="email-muted" style="margin:0 0 8px;${textStyle(C.muted, "font-size:16px;line-height:1.4;")}">${escapeHtml(greeting)}</p>
              <p class="email-muted" style="margin:0;${textStyle(C.muted, "font-size:15px;line-height:1.55;")}">${escapeHtml(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="width:100%;background:${C.card};border:2px solid ${C.accent};border-radius:16px;">
                <tr>
                  <td style="padding:22px 20px 18px;background:${C.card};border-radius:16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        ${iconCell("▣")}
                        <td valign="top" style="padding:0 0 16px;">
                          <p class="email-text" style="margin:0;${textStyle(C.text, "font-size:20px;line-height:1.3;font-weight:700;")}">${escapeHtml(title)}</p>
                          ${
                            subtitle
                              ? `<p class="email-muted" style="margin:4px 0 0;${textStyle(C.muted, "font-size:14px;line-height:1.4;")}">${escapeHtml(subtitle)}</p>`
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
                      ${detailRow("£", "Total price", priceLabel, "20px")}
                      ${detailRow("▦", "Proposed start date", proposedDateLabel)}
                      ${detailRow("◷", "Estimated duration", durationLabel)}
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
                        ${iconCell("📎")}
                        <td valign="middle" style="padding:0 0 0;">
                          <p class="email-text" style="margin:0 0 3px;${textStyle(C.text, "font-size:15px;line-height:1.4;font-weight:600;")}">A PDF copy is attached for your records.</p>
                          <p class="email-muted" style="margin:0;${textStyle(C.muted, "font-size:13px;line-height:1.4;")}">You can also download it from the portal.</p>
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
          <tr>
            <td align="center" style="padding:8px 12px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="1" style="height:1px;line-height:1px;font-size:0;background:${C.divider};">&nbsp;</td>
                </tr>
              </table>
              <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
              <p class="email-muted" style="margin:0 0 4px;${textStyle(C.muted, "font-size:12px;line-height:1.4;")}">&#128274; This is a secure customer portal</p>
              <p class="email-muted" style="margin:0;${textStyle(C.muted, "font-size:12px;line-height:1.4;")}">Powered by Reanvil</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function proposalEmailIntroHtml(message: string): string {
  return escapeHtml(message).replaceAll("\n", "<br />");
}
