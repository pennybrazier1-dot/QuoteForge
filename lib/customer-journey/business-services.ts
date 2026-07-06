import { TRADE_OPTIONS } from "./constants";
import { getConfiguredServices } from "./business-profile";
import type { BusinessType, TradeType, TradespersonInfo } from "./types";

export type BusinessServiceOption = {
  label: string;
  tradeType: TradeType;
  icon: string;
};

const SERVICE_LABEL_TO_TRADE: Record<string, TradeType> = {
  plumbing: "plumbing",
  heating: "heating",
  bathrooms: "bathroom",
  bathroom: "bathroom",
  electrical: "electrical",
  carpentry: "carpentry",
  kitchen: "kitchen",
  kitchens: "kitchen",
  "kitchen fitting": "kitchen",
  landscaping: "landscaping",
  building: "building",
  decorating: "decorating",
  "painting & decorating": "decorating",
  roofing: "roofing",
  drainage: "drainage",
  plastering: "decorating",
  tiling: "something_else",
  flooring: "carpentry",
  "windows & doors": "carpentry",
  driveways: "landscaping",
  fencing: "landscaping",
  handyman: "something_else",
  "property maintenance": "something_else",
  "handyman / property maintenance": "something_else",
};

/** Keyword hints for custom handyman labels → trade question templates. */
const SERVICE_KEYWORD_TO_TRADE: Array<[string, TradeType]> = [
  ["plumb", "plumbing"],
  ["silicone", "plumbing"],
  ["seal", "plumbing"],
  ["gutter", "drainage"],
  ["drain", "drainage"],
  ["electr", "electrical"],
  ["paint", "decorating"],
  ["garden", "landscaping"],
  ["fence", "landscaping"],
  ["floor", "carpentry"],
  ["door", "carpentry"],
  ["shelf", "carpentry"],
  ["lock", "carpentry"],
  ["curtain", "carpentry"],
  ["flat-pack", "carpentry"],
  ["assembly", "carpentry"],
  ["picture", "carpentry"],
  ["mount", "carpentry"],
  ["heat", "heating"],
  ["bath", "bathroom"],
  ["roof", "roofing"],
  ["kitchen", "kitchen"],
  ["plaster", "decorating"],
  ["tiling", "something_else"],
  ["tile", "something_else"],
  ["window", "carpentry"],
  ["driveway", "landscaping"],
  ["fenc", "landscaping"],
  ["handyman", "something_else"],
  ["property maintenance", "something_else"],
  ["build", "building"],
  ["decor", "decorating"],
  ["carpent", "carpentry"],
];

export function needsServiceSelection(tradesperson: TradespersonInfo): boolean {
  return tradesperson.businessType !== "single-trade";
}

export function hasConfigurableServices(tradesperson: TradespersonInfo): boolean {
  return needsServiceSelection(tradesperson);
}

export const SERVICE_PICKER_HINT =
  "Not sure? Choose the closest option or describe the work later.";

export const CANT_SEE_SERVICE_LABEL = "Can't see your service?";

export function resolveServiceTradeType(serviceLabel: string): TradeType {
  const normalized = serviceLabel.trim().toLowerCase();

  const fromCatalog = TRADE_OPTIONS.find(
    (trade) => trade.label.toLowerCase() === normalized
  );

  if (fromCatalog) {
    return fromCatalog.id;
  }

  if (SERVICE_LABEL_TO_TRADE[normalized]) {
    return SERVICE_LABEL_TO_TRADE[normalized];
  }

  const keywordMatch = SERVICE_KEYWORD_TO_TRADE.find(([keyword]) =>
    normalized.includes(keyword)
  );

  if (keywordMatch) {
    return keywordMatch[1];
  }

  const partialMatch = Object.entries(SERVICE_LABEL_TO_TRADE).find(([key]) =>
    normalized.includes(key)
  );

  if (partialMatch) {
    return partialMatch[1];
  }

  return "something_else";
}

export function getTradeIcon(tradeType: TradeType): string {
  return (
    TRADE_OPTIONS.find((trade) => trade.id === tradeType)?.icon ?? "more"
  );
}

export function getBusinessServiceOptions(
  tradesperson: TradespersonInfo
): BusinessServiceOption[] {
  return getConfiguredServices(tradesperson).map((label) => {
    const tradeType = resolveServiceTradeType(label);

    return {
      label,
      tradeType,
      icon: getTradeIcon(tradeType),
    };
  });
}

export function getPrimaryServiceLabel(
  tradesperson: TradespersonInfo
): string | null {
  const configured = getConfiguredServices(tradesperson);

  if (configured.length > 0) {
    return configured[0];
  }

  const catalogLabel = TRADE_OPTIONS.find(
    (trade) => trade.id === tradesperson.tradeType
  )?.label;

  return catalogLabel ?? null;
}

export function getWorkTypeStepCopy(businessType: BusinessType): {
  title: string;
  description: string;
  ariaLabel: string;
  sidebarTitle: string;
  sidebarDescription: string;
} {
  if (businessType === "handyman") {
    return {
      title: "What do you need help with?",
      description:
        "Pick the job you need — only the services we offer are listed here.",
      ariaLabel: "Service needed",
      sidebarTitle: "Pick a job",
      sidebarDescription: "Choose from our services",
    };
  }

  return {
    title: "What can we help you with today?",
    description:
      "Choose the service you need — we'll tailor the next questions.",
    ariaLabel: "Service needed",
    sidebarTitle: "Choose a service",
    sidebarDescription: "Pick what you need",
  };
}
