export const MOBILE_FORM_LAYOUT = {
  pagePaddingToken: "var(--page-padding-mobile)",
  extraInlinePadding: "0",
  maxWidth: "100%",
  cardPadding: "1rem",
  cardRadiusToken: "var(--radius-card)",
  cardGap: "0.75rem",
  matchesHomeContentWidth: true,
} as const;

export function mobileFormUsesHomeWidth(): boolean {
  return (
    MOBILE_FORM_LAYOUT.extraInlinePadding === "0" &&
    MOBILE_FORM_LAYOUT.maxWidth === "100%" &&
    MOBILE_FORM_LAYOUT.matchesHomeContentWidth
  );
}
