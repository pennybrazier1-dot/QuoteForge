export type BusinessType = "single-trade" | "multi-trade" | "handyman";

export type TradeType =
  | "electrical"
  | "plumbing"
  | "kitchen"
  | "bathroom"
  | "building"
  | "roofing"
  | "landscaping"
  | "carpentry"
  | "decorating"
  | "heating"
  | "drainage"
  | "something_else";

export type PropertyType =
  | "house"
  | "flat"
  | "bungalow"
  | "commercial"
  | "other";

export type MeasurementAnswer = "yes" | "no" | null;

export type JourneyStepId =
  | "welcome"
  | "work_type"
  | "details"
  | "property"
  | "project"
  | "photos"
  | "measurements"
  | "trade_questions"
  | "review"
  | "thank_you";

export type TradeQuestionType = "text" | "textarea" | "select" | "radio";

export type TradeQuestion = {
  id: string;
  label: string;
  type: TradeQuestionType;
  options?: string[];
  placeholder?: string;
  helperText?: string;
  /** Defaults to true. Optional questions never block Continue. */
  required?: boolean;
};

export type MeasurementField = {
  id: string;
  label: string;
  unit: string;
  value: string;
};

export type JourneyFormData = {
  trade: TradeType | null;
  /** Customer-facing service label — set from the business profile or customer selection. */
  selectedService: string | null;
  name: string;
  mobile: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  propertyType: PropertyType | null;
  projectDescription: string;
  photos: File[];
  knowsMeasurements: MeasurementAnswer;
  measurements: MeasurementField[];
  tradeAnswers: Record<string, string>;
};

export type JourneyStepConfig = {
  id: JourneyStepId;
  number: number;
  title: string;
  description: string;
  icon: string;
};

export type TradespersonInfo = {
  businessName: string;
  contactName: string;
  phone: string;
  brandName: string;
  businessType: BusinessType;
  /** Primary trade for single-trade businesses — used to load the enquiry template. */
  tradeType: TradeType;
  /** Configured services shown to customers (add/remove/reorder via onboarding later). */
  services: string[];
};
