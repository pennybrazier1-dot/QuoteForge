/**
 * Customer-facing business identity for proposals/PDFs/emails.
 * Admin and test workspace names must never appear as branding.
 */

const NON_CUSTOMER_BUSINESS_NAME_PATTERNS: RegExp[] = [
  /^reanvil\s+admin(?:\s+testing)?$/i,
  /^platform\s+admin$/i,
  /^admin\s+testing$/i,
  /^test(?:ing)?\s+workspace$/i,
];

export const CUSTOMER_FACING_BUSINESS_NAME_FALLBACK = "Your Business";

/**
 * Demo workspace name for newly bootstrapped platform-admin accounts.
 * Must look like a trader business, not an admin label.
 */
export const PLATFORM_ADMIN_DEMO_BUSINESS_NAME = "Demo Trade Co";

export function isNonCustomerFacingBusinessName(businessName: string): boolean {
  const trimmed = businessName.trim();
  if (!trimmed) {
    return true;
  }

  if (NON_CUSTOMER_BUSINESS_NAME_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  // Catch odd variants like "Platform Admin Testing Workspace"
  if (/platform\s+admin/i.test(trimmed)) {
    return true;
  }

  if (/reanvil\s+admin/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function resolveCustomerFacingBusinessName(
  businessName: string | null | undefined
): string {
  const trimmed = businessName?.trim() ?? "";
  if (!trimmed || isNonCustomerFacingBusinessName(trimmed)) {
    return CUSTOMER_FACING_BUSINESS_NAME_FALLBACK;
  }
  return trimmed;
}
