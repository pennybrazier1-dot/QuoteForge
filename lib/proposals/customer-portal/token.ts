import { getSiteUrl } from "@/lib/env/site-url";

/**
 * Portal path/URL helpers — safe for Client Components.
 * Token generation lives in create-customer-access-token.ts (server-only crypto).
 */

export function buildCustomerProposalPortalPath(token: string): string {
  return `/p/${encodeURIComponent(token)}`;
}

export function buildCustomerProposalPortalUrl(token: string): string {
  return `${getSiteUrl()}${buildCustomerProposalPortalPath(token)}`;
}

export function buildCustomerProposalPdfPath(token: string): string {
  return `${buildCustomerProposalPortalPath(token)}/pdf`;
}

export function buildCustomerProposalPdfUrl(token: string): string {
  return `${getSiteUrl()}${buildCustomerProposalPdfPath(token)}`;
}
