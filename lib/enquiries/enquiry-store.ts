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

function readEnquiries(): StoredEnquiry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredEnquiry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEnquiries(enquiries: StoredEnquiry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enquiries));
  notifyEnquiriesUpdated();
}

export function getStoredEnquiries(): StoredEnquiry[] {
  return readEnquiries().sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)
  );
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

  enquiries[index] = updated;
  writeEnquiries(enquiries);
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
