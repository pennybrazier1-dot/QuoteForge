/**
 * Design tokens measured from the approved Sneddons PDF mock-up.
 * A4 = 595.28 × 841.89 pt. Content width at 56 pt margins ≈ 483 pt.
 */
export const PDF_COLORS = {
  orange: "#FF6A1A",
  text: "#1A1A1A",
  muted: "#8A8A8A",
  faint: "#B5B5B5",
  card: "#F5F5F5",
  cardBorder: "#E8E8E8",
  cardPeach: "#FBF6F2",
  cardPeachBorder: "#F0E6DE",
  rule: "#E5E5E5",
  white: "#FFFFFF",
} as const;

export const PDF_PAGE = {
  size: "A4" as const,
  /** ~20 mm — matches mock-up margins */
  margin: 56,
  footerReserve: 38,
};

export const SP = {
  xs: 5,
  sm: 9,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

export const PDF_RADIUS = 8;
export const LOGO_SIZE = 52;
export const ICON_SIZE = 15;
export const CARD_PAD = 16;
export const CARD_ICON = 28;

/** Mock-up column proportions */
export const COL_LEFT = 0.58;
export const COL_RIGHT = 0.38;
