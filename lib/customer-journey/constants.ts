import type {
  BusinessType,
  JourneyStepConfig,
  MeasurementField,
  TradeType,
  TradespersonInfo,
} from "./types";
import {
  EXAMPLE_HANDYMAN_SERVICES,
  EXAMPLE_MULTI_TRADE_SERVICES,
} from "./business-profile";

function includesServiceStep(businessType: BusinessType): boolean {
  return businessType !== "single-trade";
}

export const PLACEHOLDER_TRADESPERSON: TradespersonInfo = {
  brandName: "Alex",
  businessName: "Smith Plumbing",
  contactName: "John",
  phone: "07700 900 123",
  businessType: "single-trade",
  tradeType: "plumbing",
  services: ["Plumbing"],
};

/** Example multi-trade profile — swap into the provider to preview that journey. */
export const PLACEHOLDER_MULTI_TRADE: TradespersonInfo = {
  brandName: "Alex",
  businessName: "Smith Home Services",
  contactName: "John",
  phone: "07700 900 123",
  businessType: "multi-trade",
  tradeType: "plumbing",
  services: [...EXAMPLE_MULTI_TRADE_SERVICES],
};

/** Example handyman profile — services are fully customisable per business. */
export const PLACEHOLDER_HANDYMAN: TradespersonInfo = {
  brandName: "Alex",
  businessName: "Smith Property Care",
  contactName: "John",
  phone: "07700 900 123",
  businessType: "handyman",
  tradeType: "something_else",
  services: [...EXAMPLE_HANDYMAN_SERVICES],
};

export type JourneyPreviewProfileId = "single-trade" | "multi-trade" | "handyman";

export const JOURNEY_PREVIEW_PROFILES: Record<
  JourneyPreviewProfileId,
  { label: string; tradesperson: TradespersonInfo }
> = {
  "single-trade": {
    label: "Single trade: Smith Plumbing",
    tradesperson: PLACEHOLDER_TRADESPERSON,
  },
  "multi-trade": {
    label: "Multi-trade: example business",
    tradesperson: PLACEHOLDER_MULTI_TRADE,
  },
  handyman: {
    label: "Handyman: example tradesperson",
    tradesperson: PLACEHOLDER_HANDYMAN,
  },
};

export const TRADE_OPTIONS: {
  id: TradeType;
  label: string;
  icon: string;
}[] = [
  { id: "electrical", label: "Electrical", icon: "zap" },
  { id: "plumbing", label: "Plumbing", icon: "droplet" },
  { id: "carpentry", label: "Carpentry", icon: "hammer" },
  { id: "kitchen", label: "Kitchen", icon: "utensils" },
  { id: "bathroom", label: "Bathroom", icon: "bath" },
  { id: "landscaping", label: "Landscaping", icon: "tree" },
  { id: "building", label: "Building", icon: "building" },
  { id: "decorating", label: "Decorating", icon: "paint" },
  { id: "roofing", label: "Roofing", icon: "home" },
  { id: "heating", label: "Heating", icon: "flame" },
  { id: "drainage", label: "Drainage", icon: "waves" },
  { id: "something_else", label: "Something Else", icon: "more" },
];

export const PROPERTY_TYPES = [
  { id: "house" as const, label: "House" },
  { id: "flat" as const, label: "Flat / Apartment" },
  { id: "bungalow" as const, label: "Bungalow" },
  { id: "commercial" as const, label: "Commercial" },
  { id: "other" as const, label: "Other" },
];

export const JOURNEY_STEP_DEFINITIONS = {
  welcome: {
    id: "welcome" as const,
    title: "Welcome",
    description: "Get started",
    icon: "grid",
  },
  work_type: {
    id: "work_type" as const,
    title: "Type of work",
    description: "Pick the closest match",
    icon: "grid",
  },
  details: {
    id: "details" as const,
    title: "Your details",
    description: "Just the basics",
    icon: "user",
  },
  property: {
    id: "property" as const,
    title: "Property",
    description: "Where is the job?",
    icon: "home",
  },
  project: {
    id: "project" as const,
    title: "Project details",
    description: "In your own words",
    icon: "file",
  },
  photos: {
    id: "photos" as const,
    title: "Photos",
    description: "Optional but helpful",
    icon: "camera",
  },
  measurements: {
    id: "measurements" as const,
    title: "Measurements",
    description: "Only if you know them",
    icon: "ruler",
  },
  trade_questions: {
    id: "trade_questions" as const,
    title: "A few quick questions",
    description: "Helps us prepare",
    icon: "help",
  },
  review: {
    id: "review" as const,
    title: "Review & send",
    description: "Then you're finished",
    icon: "check",
  },
} satisfies Record<
  Exclude<
    import("./types").JourneyStepId,
    "thank_you"
  >,
  Omit<import("./types").JourneyStepConfig, "number">
>;

export function getJourneySteps(tradesperson: TradespersonInfo): JourneyStepConfig[] {
  const stepIds: Array<keyof typeof JOURNEY_STEP_DEFINITIONS> = [
    "welcome",
    ...(includesServiceStep(tradesperson.businessType) ? (["work_type"] as const) : []),
    "details",
    "property",
    "project",
    "photos",
    "measurements",
    "trade_questions",
    "review",
  ];

  const workTypeSidebarCopy = includesServiceStep(tradesperson.businessType)
    ? tradesperson.businessType === "handyman"
      ? {
          sidebarTitle: "Pick a job",
          sidebarDescription: "Choose from our services",
        }
      : {
          sidebarTitle: "Choose a service",
          sidebarDescription: "Pick what you need",
        }
    : null;

  return stepIds.map((stepId, index) => {
    const base = JOURNEY_STEP_DEFINITIONS[stepId];

    if (stepId === "work_type" && workTypeSidebarCopy) {
      return {
        ...base,
        number: index + 1,
        title: workTypeSidebarCopy.sidebarTitle,
        description: workTypeSidebarCopy.sidebarDescription,
      };
    }

    return {
      ...base,
      number: index + 1,
    };
  });
}

export const WHAT_HAPPENS_NEXT = [
  "John will review your request — usually within one working day",
  "You'll get a clear quote with no surprise costs",
  "If a visit is needed, we'll arrange a time that suits you",
];

export const DEFAULT_MEASUREMENT_FIELDS: MeasurementField[] = [
  { id: "rough_size", label: "Rough size", unit: "m", value: "" },
];
