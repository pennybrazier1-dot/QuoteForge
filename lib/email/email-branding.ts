import { resolveProposalEmailBusinessName } from "@/lib/email/proposal-email-presentation";
import { resolveCustomerFacingBusinessLogoUrl } from "@/lib/proposals/pdf/customer-branding";

/** Shared Reanvil wordmark until a trader uploads a real business logo. */
export const REANVIL_EMAIL_BRAND_NAME = "REANVIL";

export type EmailBrandIdentity = {
  mode: "trader" | "reanvil";
  logoUrl: string | null;
  brandName: string;
  businessName: string | null;
};

export function hasRealBusinessLogo(
  logoUrl: string | null | undefined
): boolean {
  return Boolean(resolveCustomerFacingBusinessLogoUrl(logoUrl));
}

/**
 * Customer emails: real uploaded logo + business name when available.
 * Otherwise the Reanvil app name. Never invent a fake trader logo.
 */
export function resolveEmailBrandIdentity(input: {
  logoUrl?: string | null;
  businessName?: string | null;
}): EmailBrandIdentity {
  const logoUrl = resolveCustomerFacingBusinessLogoUrl(input.logoUrl);
  const businessName = resolveProposalEmailBusinessName(input.businessName);

  if (logoUrl) {
    return {
      mode: "trader",
      logoUrl,
      brandName: businessName || REANVIL_EMAIL_BRAND_NAME,
      businessName,
    };
  }

  return {
    mode: "reanvil",
    logoUrl: null,
    brandName: REANVIL_EMAIL_BRAND_NAME,
    businessName,
  };
}

export function customerMessageSenderCopy(
  businessName: string | null | undefined
): string {
  const resolved = resolveProposalEmailBusinessName(businessName);
  return resolved
    ? `${resolved} has sent you a message.`
    : "Your trader has sent you a message.";
}
