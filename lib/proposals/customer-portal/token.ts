import { randomBytes } from "node:crypto";
import { getSiteUrl } from "@/lib/env/site-url";

const TOKEN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Cryptographically strong opaque token for /p/[token]. */
export function createCustomerAccessToken(length = 32): string {
  const bytes = randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i += 1) {
    token += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  }
  return token;
}

export function buildCustomerProposalPortalPath(token: string): string {
  return `/p/${encodeURIComponent(token)}`;
}

export function buildCustomerProposalPortalUrl(token: string): string {
  return `${getSiteUrl()}${buildCustomerProposalPortalPath(token)}`;
}

export function buildCustomerProposalPdfPath(token: string): string {
  return `${buildCustomerProposalPortalPath(token)}/pdf`;
}
