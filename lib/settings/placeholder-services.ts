import { EXAMPLE_HANDYMAN_SERVICES } from "@/lib/customer-journey/business-profile";

/**
 * Placeholder services for Settings until onboarding/settings persistence exists.
 * Customer enquiry journeys still use TradespersonInfo profiles separately today.
 */
export function getPlaceholderServicesFromTradeType(
  tradeType: string | null
): string[] {
  const trimmed = tradeType?.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed === "General Handyman") {
    return [...EXAMPLE_HANDYMAN_SERVICES];
  }

  return [trimmed];
}
