import type { JourneyStepConfig, TradeType, TradespersonInfo } from "./types";

export const PLACEHOLDER_TRADESPERSON: TradespersonInfo = {
  brandName: "Alex",
  businessName: "Smith Plumbing & Heating",
  contactName: "John",
  phone: "07700 900 123",
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

export const JOURNEY_STEPS: JourneyStepConfig[] = [
  {
    id: "trade",
    number: 1,
    title: "What needs doing?",
    description: "Pick the closest match",
    icon: "grid",
  },
  {
    id: "details",
    number: 2,
    title: "How can we reach you?",
    description: "Just the basics",
    icon: "user",
  },
  {
    id: "property",
    number: 3,
    title: "Where is the job?",
    description: "So we know where to come",
    icon: "home",
  },
  {
    id: "project",
    number: 4,
    title: "Tell us what's needed",
    description: "In your own words",
    icon: "file",
  },
  {
    id: "photos",
    number: 5,
    title: "Photos",
    description: "Optional but helpful",
    icon: "camera",
  },
  {
    id: "measurements",
    number: 6,
    title: "Sizes",
    description: "Only if you know them",
    icon: "ruler",
  },
  {
    id: "trade_questions",
    number: 7,
    title: "Almost done",
    description: "A few quick taps",
    icon: "help",
  },
  {
    id: "review",
    number: 8,
    title: "Review & send",
    description: "Then you're finished",
    icon: "check",
  },
];

export const WHAT_HAPPENS_NEXT = [
  "John will review your request — usually within one working day",
  "You'll get a clear quote with no surprise costs",
  "If a visit is needed, we'll arrange a time that suits you",
];

export const DEFAULT_MEASUREMENT_FIELDS = [
  { id: "rough_size", label: "Rough size", unit: "m", value: "" },
];
