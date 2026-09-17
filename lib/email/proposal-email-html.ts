const EMAIL_BG = "#08080a";
const EMAIL_CARD = "#ffffff";
const EMAIL_TEXT = "#111113";
const EMAIL_MUTED = "#52525b";
const EMAIL_ACCENT = "#ff6a1a";

export type ProposalEmailHtmlInput = {
  businessName: string;
  businessLogoUrl?: string | null;
  customerName?: string | null;
  introHtml: string;
  portalUrl: string;
  pdfUrl?: string | null;
  ctaLabel?: string | null;
  title?: string | null;
  priceLabel?: string | null;
  proposedDateLabel?: string | null;
  scopeSummary?: string | null;
};

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

function summaryRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${EMAIL_MUTED};">
    ${escapeHtml(label)}
  </td>
</tr>
<tr>
  <td style="padding:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.45;color:${EMAIL_TEXT};">
    ${escapeHtml(value)}
  </td>
</tr>`;
}

/**
 * Email-safe HTML for the customer proposal message.
 * Tables + inline styles only — no advanced CSS.
 */
export function buildProposalEmailHtml(input: ProposalEmailHtmlInput): string {
  const businessName = input.businessName.trim() || "Your Business";
  const portalUrl = safeHttpUrl(input.portalUrl);
  const pdfUrl = safeHttpUrl(input.pdfUrl);
  const logoUrl = safeHttpUrl(input.businessLogoUrl);
  const ctaLabel = input.ctaLabel?.trim() || "View proposal";
  const title = input.title?.trim() || "Your proposal";
  const priceLabel = input.priceLabel?.trim() || "";
  const proposedDateLabel = input.proposedDateLabel?.trim() || "";
  const scopeSummary = input.scopeSummary?.trim() || "";

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="56" height="56" alt="${escapeHtml(businessName)}" style="display:block;border:0;width:56px;height:56px;object-fit:contain;margin:0 0 16px;" />`
    : "";

  const button = portalUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;">
  <tr>
    <td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:8px;">
      <a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
        ${escapeHtml(ctaLabel)}
      </a>
    </td>
  </tr>
</table>
<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${EMAIL_MUTED};">
  Or paste this link into your browser:<br />
  <a href="${escapeHtml(portalUrl)}" style="color:${EMAIL_TEXT};">${escapeHtml(portalUrl)}</a>
</p>`
    : "";

  const pdfLink = pdfUrl
    ? `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;">
  <a href="${escapeHtml(pdfUrl)}" style="color:${EMAIL_ACCENT};font-weight:700;text-decoration:none;">Download PDF</a>
</p>`
    : `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${EMAIL_MUTED};">A PDF copy is also attached.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:${EMAIL_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL_BG}" style="background:${EMAIL_BG};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td bgcolor="${EMAIL_CARD}" style="background:${EMAIL_CARD};border-radius:12px;padding:28px 24px 24px;">
              ${logoBlock}
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;font-weight:800;color:${EMAIL_TEXT};">
                ${escapeHtml(businessName)}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${EMAIL_MUTED};">
                Your proposal is ready
              </p>
            </td>
          </tr>
          <tr>
            <td height="16" style="height:16px;line-height:16px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${EMAIL_CARD}" style="background:${EMAIL_CARD};border-radius:12px;padding:28px 24px;">
              <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;color:${EMAIL_ACCENT};">
                Your proposal
              </p>
              ${summaryRow("Job", title)}
              ${priceLabel ? summaryRow("Price", priceLabel) : ""}
              ${proposedDateLabel ? summaryRow("Proposed date", proposedDateLabel) : ""}
              ${scopeSummary ? summaryRow("Summary", scopeSummary) : ""}
              <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
                ${input.introHtml}
              </p>
              ${button}
              ${pdfLink}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#a1a1aa;">
              Powered by Reanvil
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
