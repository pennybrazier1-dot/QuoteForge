import type { MeasurementField } from "@/lib/customer-journey/types";

export type EnquiryStatus =
  | "new"
  | "reviewing"
  | "site_visit_booked"
  | "declined";

export type EnquiryTimelineEvent = {
  id: string;
  label: string;
  at: string;
};

export type EnquiryTradeAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

export type StoredEnquiry = {
  id: string;
  status: EnquiryStatus;
  receivedAt: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  serviceRequested: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  propertyType: string | null;
  projectDescription: string;
  photoCount: number;
  hasMeasurements: boolean;
  measurements: MeasurementField[];
  tradeAnswers: EnquiryTradeAnswer[];
  tradespersonBusiness: string;
  suggestedNextAction: string;
  timeline: EnquiryTimelineEvent[];
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  site_visit_booked: "Site Visit Booked",
  declined: "Declined",
};

export const ENQUIRY_STATUS_TONES: Record<
  EnquiryStatus,
  "blue" | "amber" | "green" | "muted"
> = {
  new: "blue",
  reviewing: "amber",
  site_visit_booked: "green",
  declined: "muted",
};
