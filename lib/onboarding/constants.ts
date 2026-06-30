export const TRADE_TYPES = [
  "Plumber",
  "Electrician",
  "Carpenter",
  "Bricklayer",
  "Kitchen Fitter",
  "Builder",
  "Landscaper",
  "Painter and Decorator",
  "Fencing Contractor",
  "Roofer",
  "Heating Engineer",
  "Plasterer",
  "Tiler",
  "Window and Door Installer",
  "Driveway and Paving Contractor",
  "Drainage Specialist",
  "General Handyman",
  "Other",
] as const;

export const HEARD_ABOUT_OPTIONS = [
  "Google",
  "Facebook",
  "TikTok",
  "YouTube",
  "Recommendation",
  "Local business group",
  "Other",
] as const;

export const DEFAULT_PAYMENT_TERMS =
  "Payment due within 7 days of acceptance unless otherwise agreed.";

export type TradeType = (typeof TRADE_TYPES)[number];
export type HeardAboutOption = (typeof HEARD_ABOUT_OPTIONS)[number];

export function isTradeType(value: string): value is TradeType {
  return TRADE_TYPES.includes(value as TradeType);
}

export function isHeardAboutOption(value: string): value is HeardAboutOption {
  return HEARD_ABOUT_OPTIONS.includes(value as HeardAboutOption);
}
