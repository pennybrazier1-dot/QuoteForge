/**
 * Canonical site origin for server-side auth redirects (signup email links, etc.).
 * Preview deployments: uses VERCEL_URL automatically (no extra env needed).
 *
 * Production customer emails and portal links must use www.reanvil.com.
 * Apex (reanvil.com) redirects there; app.reanvil.com is not a working portal host.
 */

export const PRODUCTION_SITE_URL = "https://www.reanvil.com";

const PRODUCTION_HOST_ALIASES = new Set([
  "reanvil.com",
  "www.reanvil.com",
  "app.reanvil.com",
]);

/** Normalize known Reanvil production hosts to the live www origin. */
export function normalizeSiteUrl(raw: string): string {
  const cleaned = raw.trim().replace(/\/$/, "");
  if (!cleaned) {
    return cleaned;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    if (PRODUCTION_HOST_ALIASES.has(host)) {
      return PRODUCTION_SITE_URL;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(
      /\/$/,
      ""
    );
  } catch {
    return cleaned;
  }
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return normalizeSiteUrl(configured);
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return normalizeSiteUrl(`https://${vercelHost.replace(/\/$/, "")}`);
  }

  return "http://localhost:3000";
}
