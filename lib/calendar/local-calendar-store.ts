"use client";

import { formatEnquiryAddress } from "@/lib/enquiries/format";
import type { StoredEnquiry } from "@/lib/enquiries/types";

const STORAGE_KEY = "quoteforge:calendar-events";
const CALENDAR_EVENTS_UPDATED = "quoteforge:calendar-events-updated";

export type LocalSiteVisitEvent = {
  id: string;
  kind: "site_visit";
  enquiryId: string;
  title: string;
  customerName: string;
  address: string;
  startsAt: string;
  dateIso: string;
  slotLabel: string;
  status: "site_visit_booked";
  createdAt: string;
};

export const EMPTY_LOCAL_SITE_VISIT_EVENTS: LocalSiteVisitEvent[] = [];

let eventsSnapshot: LocalSiteVisitEvent[] = EMPTY_LOCAL_SITE_VISIT_EVENTS;
let eventsSnapshotKey = "";

export function subscribeToLocalCalendarEvents(
  onStoreChange: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener(CALENDAR_EVENTS_UPDATED, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(CALENDAR_EVENTS_UPDATED, handler);
    window.removeEventListener("storage", handler);
  };
}

function notifyCalendarEventsUpdated(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CALENDAR_EVENTS_UPDATED));
}

function readEvents(): LocalSiteVisitEvent[] {
  if (typeof window === "undefined") {
    return EMPTY_LOCAL_SITE_VISIT_EVENTS;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY) ?? "[]";

  if (raw === eventsSnapshotKey) {
    return eventsSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      eventsSnapshot = EMPTY_LOCAL_SITE_VISIT_EVENTS;
      eventsSnapshotKey = raw;
      return eventsSnapshot;
    }

    eventsSnapshot = parsed.filter(
      (entry): entry is LocalSiteVisitEvent =>
        Boolean(entry) &&
        typeof entry === "object" &&
        (entry as LocalSiteVisitEvent).kind === "site_visit" &&
        typeof (entry as LocalSiteVisitEvent).enquiryId === "string" &&
        typeof (entry as LocalSiteVisitEvent).dateIso === "string"
    );
  } catch {
    eventsSnapshot = EMPTY_LOCAL_SITE_VISIT_EVENTS;
  }

  eventsSnapshotKey = raw;
  return eventsSnapshot;
}

function writeEvents(events: LocalSiteVisitEvent[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const json = JSON.stringify(events);
  window.localStorage.setItem(STORAGE_KEY, json);
  eventsSnapshot = events;
  eventsSnapshotKey = json;
  notifyCalendarEventsUpdated();
}

export function getLocalSiteVisitEvents(): LocalSiteVisitEvent[] {
  return readEvents();
}

export function upsertSiteVisitCalendarEvent(
  enquiry: StoredEnquiry,
  booking: {
    slotLabel: string;
    dateIso: string;
    startsAt: string;
  }
): LocalSiteVisitEvent {
  const events = readEvents().filter((event) => event.enquiryId !== enquiry.id);
  const nextEvent: LocalSiteVisitEvent = {
    id: `site-visit-${enquiry.id}`,
    kind: "site_visit",
    enquiryId: enquiry.id,
    title: `Site visit — ${enquiry.customerName}`,
    customerName: enquiry.customerName,
    address: formatEnquiryAddress(enquiry),
    startsAt: booking.startsAt,
    dateIso: booking.dateIso,
    slotLabel: booking.slotLabel,
    status: "site_visit_booked",
    createdAt: new Date().toISOString(),
  };

  writeEvents([...events, nextEvent]);
  return nextEvent;
}

export function removeSiteVisitCalendarEventsForEnquiry(
  enquiryId: string
): void {
  const events = readEvents().filter((event) => event.enquiryId !== enquiryId);

  if (events.length === readEvents().length) {
    return;
  }

  writeEvents(events);
}

export function clearLocalCalendarEvents(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  eventsSnapshot = EMPTY_LOCAL_SITE_VISIT_EVENTS;
  eventsSnapshotKey = "";
  notifyCalendarEventsUpdated();
}
