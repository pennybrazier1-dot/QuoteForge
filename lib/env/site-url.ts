/**
 * Canonical site origin for server-side auth redirects (signup email links, etc.).
 * Preview deployments: uses VERCEL_URL automatically (no extra env needed).
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
