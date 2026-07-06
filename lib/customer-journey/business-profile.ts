import type { TradespersonInfo } from "./types";

/**
 * Customer-visible services from a business profile, in display order.
 *
 * Today the profile stores `services: string[]`.
 * Later, onboarding/settings can persist richer records (id, label, sort order)
 * and map them here without changing the enquiry UI.
 */
export function getConfiguredServices(tradesperson: TradespersonInfo): string[] {
  return tradesperson.services
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

/**
 * Example handyman service list for previews and tests.
 * Each real business configures their own list during account setup.
 */
export const EXAMPLE_HANDYMAN_SERVICES: string[] = [
  "Door hanging",
  "Shelf fitting",
  "TV mounting",
  "Curtain poles",
  "Flat-pack assembly",
  "Small plumbing jobs",
  "Minor electrical jobs",
  "Painting touch-ups",
  "Fence repairs",
  "Garden tidy-ups",
  "General repairs",
  "Silicone sealing",
  "Picture hanging",
  "Flooring repairs",
  "Lock replacement",
  "Gutter clearing",
];
