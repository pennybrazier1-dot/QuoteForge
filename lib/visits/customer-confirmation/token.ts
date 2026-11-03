import { getSiteUrl } from "@/lib/env/site-url";

/**
 * Visit confirmation path/URL helpers — safe for Client Components.
 * Token generation lives in create-customer-access-token (server-only crypto).
 */

export function buildCustomerVisitConfirmationPath(token: string): string {
  return `/v/${encodeURIComponent(token)}`;
}

export function buildCustomerVisitConfirmationUrl(
  token: string,
  origin?: string
): string {
  const base = (origin?.trim() || getSiteUrl()).replace(/\/$/, "");
  return `${base}${buildCustomerVisitConfirmationPath(token)}`;
}
