/** Form pages reuse the same trader mobile width as Home / proposal detail. */
export const MOBILE_FORM_LAYOUT = {
  pagePaddingToken: "var(--page-padding-mobile)",
  extraInlinePadding: "0",
  maxWidth: "100%",
  cardPadding: "1rem",
  cardRadiusToken: "var(--radius-card)",
  cardGap: "0.75rem",
  matchesHomeContentWidth: true,
} as const;

/**
 * Shared class for bottom CTAs on trader forms (Visit, Quick Quote, Invoice).
 * Sticky above the measured bottom nav so the New (+) overhang cannot intercept taps.
 */
export const MOBILE_BOTTOM_ACTIONS_CLASS = "qf-mobile-bottom-actions" as const;

export function mobileFormUsesHomeWidth(): boolean {
  return (
    MOBILE_FORM_LAYOUT.extraInlinePadding === "0" &&
    MOBILE_FORM_LAYOUT.maxWidth === "100%" &&
    MOBILE_FORM_LAYOUT.matchesHomeContentWidth
  );
}
