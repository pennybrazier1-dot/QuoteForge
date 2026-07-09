"use client";

import { buildEnquiryFromJourney } from "@/lib/enquiries/build-enquiry";
import type {
  EnquiryStatus,
  EnquiryTimelineEvent,
  StoredEnquiry,
} from "@/lib/enquiries/types";
import type {
  JourneyFormData,
  TradespersonInfo,
} from "@/lib/customer-journey/types";

const STORAGE_KEY = "quoteforge:enquiries";
const ENQUIRIES_UPDATED_EVENT = "quoteforge:enquiries-updated";

export const EMPTY_ENQUIRIES: StoredEnquiry[] = [];

let enquiriesSnapshot: StoredEnquiry[] = EMPTY_ENQUIRIES;
let enquiriesSnapshotKey = "";

export function subscribeToEnquiries(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener(ENQUIRIES_UPDATED_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(ENQUIRIES_UPDATED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function notifyEnquiriesUpdated(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ENQUIRIES_UPDATED_EVENT));
}

function sortEnquiries(enquiries: StoredEnquiry[]): StoredEnquiry[] {
  if (enquiries.length === 0) {
    return EMPTY_ENQUIRIES;
  }

  return [...enquiries].sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)
  );
}

function normalizeEnquiry(value: unknown): StoredEnquiry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<StoredEnquiry>;

  if (
    typeof raw.id !== "string" ||
    typeof raw.status !== "string" ||
    typeof raw.receivedAt !== "string"
  ) {
    return null;
  }

  return {
    id: raw.id,
    status: raw.status as EnquiryStatus,
    receivedAt: raw.receivedAt,
    customerName: raw.customerName ?? "",
    customerMobile: raw.customerMobile ?? "",
    customerEmail: raw.customerEmail ?? "",
    serviceRequested: raw.serviceRequested ?? "",
    addressLine1: raw.addressLine1 ?? "",
    addressLine2: raw.addressLine2 ?? "",
    city: raw.city ?? "",
    postcode: raw.postcode ?? "",
    propertyType: raw.propertyType ?? null,
    projectDescription: raw.projectDescription ?? "",
    photoCount: typeof raw.photoCount === "number" ? raw.photoCount : 0,
    hasMeasurements: Boolean(raw.hasMeasurements),
    measurements: Array.isArray(raw.measurements) ? raw.measurements : [],
    tradeAnswers: Array.isArray(raw.tradeAnswers) ? raw.tradeAnswers : [],
    tradespersonBusiness: raw.tradespersonBusiness ?? "",
    suggestedNextAction: raw.suggestedNextAction ?? "",
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
  };
}

function parseEnquiries(raw: string): StoredEnquiry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return EMPTY_ENQUIRIES;
    }

    return sortEnquiries(
      parsed
        .map((entry) => normalizeEnquiry(entry))
        .filter((entry): entry is StoredEnquiry => entry !== null)
    );
  } catch {
    return EMPTY_ENQUIRIES;
  }
}

function readEnquiries(): StoredEnquiry[] {
  if (typeof window === "undefined") {
    return EMPTY_ENQUIRIES;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY) ?? "[]";

  if (raw === enquiriesSnapshotKey) {
    return enquiriesSnapshot;
  }

  enquiriesSnapshot = parseEnquiries(raw);
  enquiriesSnapshotKey = raw;

  return enquiriesSnapshot;
}

function writeEnquiries(enquiries: StoredEnquiry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const sorted = sortEnquiries(enquiries);
  const json = JSON.stringify(sorted);

  window.localStorage.setItem(STORAGE_KEY, json);
  enquiriesSnapshot = sorted;
  enquiriesSnapshotKey = json;
  notifyEnquiriesUpdated();
}

export function getStoredEnquiries(): StoredEnquiry[] {
  return readEnquiries();
}

export function getStoredEnquiry(id: string): StoredEnquiry | null {
  return readEnquiries().find((enquiry) => enquiry.id === id) ?? null;
}

export function persistEnquiryFromJourney(
  formData: JourneyFormData,
  tradesperson: TradespersonInfo
): StoredEnquiry {
  const enquiry = buildEnquiryFromJourney(formData, tradesperson);
  const enquiries = readEnquiries();
  writeEnquiries([enquiry, ...enquiries]);
  return enquiry;
}

function appendTimeline(
  enquiry: StoredEnquiry,
  label: string
): EnquiryTimelineEvent[] {
  const event: EnquiryTimelineEvent = {
    id: crypto.randomUUID(),
    label,
    at: new Date().toISOString(),
  };

  return [event, ...enquiry.timeline];
}

function suggestedActionForStatus(status: EnquiryStatus): string {
  switch (status) {
    case "new":
      return "Review the customer details and project description, then decide whether to book a site visit.";
    case "reviewing":
      return "Call or message the customer if you need more detail, then book a site visit or prepare a quote.";
    case "site_visit_booked":
      return "Confirm the visit date and time with the customer before you attend.";
    case "declined":
      return "No action needed. The enquiry has been declined.";
  }
}

export function updateStoredEnquiryStatus(
  id: string,
  status: EnquiryStatus,
  timelineLabel: string
): StoredEnquiry | null {
  const enquiries = readEnquiries();
  const index = enquiries.findIndex((enquiry) => enquiry.id === id);

  if (index === -1) {
    return null;
  }

  const current = enquiries[index];
  const updated: StoredEnquiry = {
    ...current,
    status,
    suggestedNextAction: suggestedActionForStatus(status),
    timeline: appendTimeline(current, timelineLabel),
  };

  const nextEnquiries = [...enquiries];
  nextEnquiries[index] = updated;
  writeEnquiries(nextEnquiries);
  return updated;
}

export function markEnquiryReviewing(id: string): StoredEnquiry | null {
  return updateStoredEnquiryStatus(id, "reviewing", "Marked as reviewing");
}

export function bookEnquirySiteVisit(id: string): StoredEnquiry | null {
  return updateStoredEnquiryStatus(
    id,
    "site_visit_booked",
    "Site visit booked"
  );
}

export function declineStoredEnquiry(id: string): StoredEnquiry | null {
  return updateStoredEnquiryStatus(id, "declined", "Enquiry declined");
}
