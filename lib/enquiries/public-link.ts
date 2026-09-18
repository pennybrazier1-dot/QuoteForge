import { getSiteUrl } from "@/lib/env/site-url";

/** QR-ready public enquiry path. Never include workspace IDs or tokens. */
export const PUBLIC_ENQUIRY_QR_PREFIX = "/t";
/** Existing public enquiry path — kept working for older shared links. */
export const PUBLIC_ENQUIRY_LEGACY_PREFIX = "/request-quote/w";

export function normalizePublicEnquirySlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function isUsablePublicEnquirySlug(slug: string): boolean {
  const normalised = normalizePublicEnquirySlug(slug);
  return /^[a-z0-9]{8,}$/.test(normalised);
}

export function buildPublicEnquiryPath(slug: string): string {
  return `${PUBLIC_ENQUIRY_QR_PREFIX}/${encodeURIComponent(
    normalizePublicEnquirySlug(slug)
  )}`;
}

export function buildLegacyPublicEnquiryPath(slug: string): string {
  return `${PUBLIC_ENQUIRY_LEGACY_PREFIX}/${encodeURIComponent(
    normalizePublicEnquirySlug(slug)
  )}`;
}

export function buildPublicEnquiryUrl(slug: string): string {
  return `${getSiteUrl()}${buildPublicEnquiryPath(slug)}`;
}

export function qrCodeMustUsePublicEnquiryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname.startsWith(`${PUBLIC_ENQUIRY_QR_PREFIX}/`) ||
      parsed.pathname.startsWith(`${PUBLIC_ENQUIRY_LEGACY_PREFIX}/`)
    );
  } catch {
    return false;
  }
}

export function publicUrlExposesPrivateData(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("/dashboard") ||
    lower.includes("/proposals/") ||
    lower.includes("/customers") ||
    lower.includes("/settings") ||
    lower.includes("/admin") ||
    lower.includes("/p/") ||
    lower.includes("payment") ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(url)
  );
}
