import { CUSTOMER_EMAIL_COLORS as C } from "@/lib/email/customer-email-tokens";

export const CUSTOMER_EMAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";

export function escapeCustomerEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function customerEmailSafeHttpUrl(
  value: string | null | undefined
): string | null {
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

export function customerEmailTextStyle(color: string, extra = ""): string {
  return `font-family:${CUSTOMER_EMAIL_FONT};color:${color};-webkit-text-fill-color:${color};${extra}`;
}

export function buildCustomerEmailIdentityHtml(input: {
  businessName: string | null;
  logoUrl: string | null;
  tradeLabel: string | null;
}): string {
  const logoBlock = input.logoUrl
    ? `<img src="${escapeCustomerEmailHtml(input.logoUrl)}" alt="${escapeCustomerEmailHtml(input.businessName || "")}" width="88" style="display:block;margin:0 auto 14px;border:0;max-width:180px;width:auto;height:auto;max-height:80px;" />`
    : "";

  const businessBlock = input.businessName
    ? `<p style="margin:0;${customerEmailTextStyle(C.text, input.logoUrl ? "font-size:15px;letter-spacing:0.12em;text-transform:uppercase;font-weight:800;line-height:1.35;" : "font-size:26px;letter-spacing:0.04em;font-weight:800;line-height:1.2;")}">${escapeCustomerEmailHtml(input.businessName)}</p>`
    : "";

  const tradeBlock = input.tradeLabel
    ? `<p style="margin:6px 0 0;${customerEmailTextStyle(C.muted, "font-size:13px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;line-height:1.4;")}">${escapeCustomerEmailHtml(input.tradeLabel)}</p>`
    : "";

  if (!logoBlock && !businessBlock) {
    return "";
  }

  return `<tr>
  <td align="center" style="padding:4px 8px 26px;">
    ${logoBlock}
    ${businessBlock}
    ${tradeBlock}
  </td>
</tr>`;
}

export function buildCustomerEmailCtaHtml(input: {
  portalUrl: string | null;
  ctaLabel: string;
}): string {
  if (!input.portalUrl) {
    return "";
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 20px;">
  <tr>
    <td align="center" bgcolor="${C.accent}" style="background:${C.accent};border-radius:14px;">
      <a href="${escapeCustomerEmailHtml(input.portalUrl)}" style="display:block;padding:16px 20px;${customerEmailTextStyle(C.buttonText, "font-size:17px;line-height:1.2;font-weight:700;text-decoration:none;text-align:center;")}">
        ${escapeCustomerEmailHtml(input.ctaLabel)}
      </a>
    </td>
  </tr>
</table>`;
}

export function buildCustomerEmailFallbackHtml(input: {
  portalUrl: string | null;
  intro: string;
  label: string;
}): string {
  if (!input.portalUrl) {
    return "";
  }
  return `<p style="margin:0 0 8px;${customerEmailTextStyle(C.muted, "font-size:13px;line-height:1.5;")}">${escapeCustomerEmailHtml(input.intro)}</p>
<p style="margin:0;"><a href="${escapeCustomerEmailHtml(input.portalUrl)}" style="${customerEmailTextStyle(C.accent, "font-size:15px;line-height:1.4;font-weight:700;text-decoration:none;")}">${escapeCustomerEmailHtml(input.label)}</a></p>`;
}

export function buildCustomerEmailFooterHtml(): string {
  return `<tr>
            <td align="center" style="padding:8px 12px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="1" style="height:1px;line-height:1px;font-size:0;background:${C.divider};">&nbsp;</td>
                </tr>
              </table>
              <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
              <p class="email-muted" style="margin:0 0 4px;${customerEmailTextStyle(C.muted, "font-size:12px;line-height:1.4;")}">&#128274; This is a secure customer portal</p>
              <p class="email-muted" style="margin:0;${customerEmailTextStyle(C.muted, "font-size:12px;line-height:1.4;")}">Powered by Reanvil</p>
            </td>
          </tr>`;
}

export function wrapCustomerEmailDocument(input: {
  title: string;
  preheader: string;
  innerRows: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeCustomerEmailHtml(input.title)}</title>
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
<body class="email-text" style="margin:0;padding:0;background:${C.page};${customerEmailTextStyle(C.text)}">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:${C.page};font-size:1px;line-height:1px;">
    ${escapeCustomerEmailHtml(input.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:28px 16px 32px;background:${C.page};">
        <table role="presentation" class="email-shell" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;">
          ${input.innerRows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function customerEmailIconCell(symbol: string, size = 40): string {
  return `<td width="${size + 12}" valign="top" style="width:${size + 12}px;padding:0 12px 16px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="${size}" height="${size}" align="center" valign="middle" bgcolor="${C.accent}" style="width:${size}px;height:${size}px;background:${C.accent};border-radius:12px;${customerEmailTextStyle("#ffffff", `font-size:${size > 44 ? "22px" : "18px"};line-height:${size}px;font-weight:700;`)}">
        ${symbol}
      </td>
    </tr>
  </table>
</td>`;
}

export function customerEmailDetailRow(
  symbol: string,
  label: string,
  value: string | null | undefined,
  valueSize = "17px"
): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  return `<tr>
  ${customerEmailIconCell(symbol)}
  <td valign="top" style="padding:0 0 18px;">
    <p style="margin:0 0 3px;${customerEmailTextStyle(C.muted, "font-size:13px;line-height:1.35;")}">${escapeCustomerEmailHtml(label)}</p>
    <p style="margin:0;${customerEmailTextStyle(C.text, `font-size:${valueSize};line-height:1.4;font-weight:700;`)}">${escapeCustomerEmailHtml(trimmed)}</p>
  </td>
</tr>`;
}
