/** Shared Reanvil colours for every customer-facing HTML email. Inline only. */
export const CUSTOMER_EMAIL_COLORS = {
  page: "#08080a",
  card: "#111114",
  cardPdf: "#16161e",
  text: "#f5f5f7",
  muted: "#a1a1aa",
  accent: "#ff6a1a",
  divider: "#2a2a30",
  buttonText: "#ffffff",
} as const;

export const PLACEHOLDER_BUSINESS_NAMES = [
  "Your Business",
  "your business",
  "Your business",
] as const;

export const BOOKING_EMAIL_HEADING = "Booking confirmed";
export const BOOKING_EMAIL_SUBJECT_FALLBACK = "Booking confirmed";
export const BOOKING_EMAIL_CTA_LABEL = "View booking";
export const BOOKING_EMAIL_FALLBACK_LINK_LABEL = "Open secure portal";
export const BOOKING_EMAIL_PREHEADER = "Your booking is confirmed.";
export const BOOKING_EMAIL_SUPPORTING_COPY =
  "You can review your accepted proposal and booking details in your secure customer portal.";
