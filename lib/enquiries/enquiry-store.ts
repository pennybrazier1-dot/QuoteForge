"use client";

import { upsertSiteVisitCalendarEvent, removeSiteVisitCalendarEventsForEnquiry } from "@/lib/calendar/local-calendar-store";
import { buildEnquiryFromJourney } from "@/lib/enquiries/build-enquiry";
import { buildPhotoMetadataFromFiles } from "@/lib/enquiries/photo-metadata";
import { parseStoredEnquiries } from "@/lib/enquiries/normalize-enquiry";
import { deleteEnquiryPhotoBlobs } from "@/lib/enquiries/photo-blob-store";
import {
  clearSessionPhotosForEnquiry,
  registerSessionPhotosFromFiles,
} from "@/lib/enquiries/photo-session-store";
import {
  EnquiryPersistError,
  isStorageQuotaError,
  toEnquiryPersistError,
} from "@/lib/enquiries/persist-errors";
import {
  formatTimelineCustomerConfirmationLinkCreated,
  formatTimelineCustomerCalled,
  formatTimelineCustomerEmailPrepared,
  formatTimelineCustomerMessageCopied,
  formatTimelineCustomerMessagePrepared,
  formatTimelineCustomerTextPrepared,
  formatTimelineEnquiryDeclined,
  formatTimelineEnquiryReviewed,
  formatTimelineSiteVisitBooked,
  formatTimelineSiteVisitRequested,
} from "@/lib/enquiries/timeline-messages";
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

export type SiteVisitBookingInput = {
  slotId: string;
  slotLabel: string;
  confirmationLine: string;
  dateIso: string;
  startsAt: string;
};

export type EnquiryContactMethod = "call" | "text" | "email" | "copy";
export type EnquiryContactContext = "question" | "site_visit";

let enquiriesSnapshot: StoredEnquiry[] = EMPTY_ENQUIRIES;
let enquiriesSnapshotKey = "";
let migrationWriteScheduled = false;

export function clearLocalTestEnquiries(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  enquiriesSnapshot = EMPTY_ENQUIRIES;
  enquiriesSnapshotKey = "";
  notifyEnquiriesUpdated();
}

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

function scheduleMigrationWrite(enquiries: StoredEnquiry[]): void {
  if (typeof window === "undefined" || migrationWriteScheduled) {
    return;
  }

  migrationWriteScheduled = true;

  queueMicrotask(() => {
    migrationWriteScheduled = false;

    try {
      const sorted = sortEnquiries(enquiries);
      const json = JSON.stringify(sorted);

      if (json === enquiriesSnapshotKey) {
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, json);
      enquiriesSnapshot = sorted;
      enquiriesSnapshotKey = json;
    } catch {
      // Keep in-memory normalized data even if rewrite fails.
    }
  });
}

function parseEnquiries(raw: string): StoredEnquiry[] {
  const { enquiries, needsMigration } = parseStoredEnquiries(raw);

  if (needsMigration && enquiries.length > 0) {
    scheduleMigrationWrite(enquiries);
  }

  return enquiries.length === 0 ? EMPTY_ENQUIRIES : sortEnquiries(enquiries);
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

  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    throw toEnquiryPersistError(error);
  }

  enquiriesSnapshot = sorted;
  enquiriesSnapshotKey = json;
  notifyEnquiriesUpdated();
}

function writeEnquiryWithFallback(
  enquiry: StoredEnquiry,
  existingEnquiries: StoredEnquiry[]
): StoredEnquiry {
  try {
    writeEnquiries([enquiry, ...existingEnquiries]);
    return enquiry;
  } catch (error) {
    if (!isStorageQuotaError(error)) {
      throw toEnquiryPersistError(error);
    }
  }

  for (const keepCount of [8, 4, 1, 0]) {
    try {
      writeEnquiries([enquiry, ...existingEnquiries.slice(0, keepCount)]);
      return enquiry;
    } catch (error) {
      if (!isStorageQuotaError(error)) {
        throw toEnquiryPersistError(error);
      }
    }
  }

  throw new EnquiryPersistError(
    "We couldn't save your request because this browser's storage is full. Please clear older site data in your browser settings and try again."
  );
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

function enquiryHasTimelineLabel(enquiry: StoredEnquiry, label: string): boolean {
  return enquiry.timeline.some((event) => event.label === label);
}

function updateEnquiryAtIndex(
  enquiries: StoredEnquiry[],
  index: number,
  updater: (current: StoredEnquiry) => StoredEnquiry
): StoredEnquiry {
  const nextEnquiries = [...enquiries];
  nextEnquiries[index] = updater(enquiries[index]);
  writeEnquiries(nextEnquiries);
  return nextEnquiries[index];
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

export function getStoredEnquiries(): StoredEnquiry[] {
  return readEnquiries();
}

export function getStoredEnquiry(id: string): StoredEnquiry | null {
  return readEnquiries().find((enquiry) => enquiry.id === id) ?? null;
}

export async function persistEnquiryFromJourney(
  formData: JourneyFormData,
  tradesperson: TradespersonInfo
): Promise<StoredEnquiry> {
  try {
    const photos = buildPhotoMetadataFromFiles(formData.photos);
    const enquiry = buildEnquiryFromJourney(formData, tradesperson, photos);
    registerSessionPhotosFromFiles(
      enquiry.id,
      photos,
      formData.photos.slice(0, photos.length)
    );
    const enquiries = readEnquiries();

    return writeEnquiryWithFallback(enquiry, enquiries);
  } catch (error) {
    throw toEnquiryPersistError(error);
  }
}

export function appendEnquiryTimelineEvent(
  id: string,
  label: string
): StoredEnquiry | null {
  const enquiries = readEnquiries();
  const index = enquiries.findIndex((enquiry) => enquiry.id === id);

  if (index === -1) {
    return null;
  }

  const current = enquiries[index];

  if (enquiryHasTimelineLabel(current, label)) {
    return current;
  }

  return updateEnquiryAtIndex(enquiries, index, (entry) => ({
    ...entry,
    timeline: appendTimeline(entry, label),
  }));
}

export function markEnquiryReviewing(id: string): StoredEnquiry | null {
  const enquiries = readEnquiries();
  const index = enquiries.findIndex((enquiry) => enquiry.id === id);

  if (index === -1) {
    return null;
  }

  const current = enquiries[index];
  const timelineLabel = formatTimelineEnquiryReviewed(current.customerName);

  if (current.status === "reviewing" && enquiryHasTimelineLabel(current, timelineLabel)) {
    return current;
  }

  return updateEnquiryAtIndex(enquiries, index, (entry) => ({
    ...entry,
    status: "reviewing",
    suggestedNextAction: suggestedActionForStatus("reviewing"),
    timeline: enquiryHasTimelineLabel(entry, timelineLabel)
      ? entry.timeline
      : appendTimeline(entry, timelineLabel),
  }));
}

export function recordSiteVisitRequested(id: string): StoredEnquiry | null {
  return appendEnquiryTimelineEvent(id, formatTimelineSiteVisitRequested());
}

export function recordEnquiryCustomerContact(
  id: string,
  method: EnquiryContactMethod,
  context: EnquiryContactContext
): StoredEnquiry | null {
  const label =
    method === "call"
      ? formatTimelineCustomerCalled()
      : method === "text"
        ? formatTimelineCustomerTextPrepared()
        : method === "email"
          ? formatTimelineCustomerEmailPrepared()
          : context === "site_visit"
            ? formatTimelineCustomerMessageCopied()
            : formatTimelineCustomerMessagePrepared();

  return appendEnquiryTimelineEvent(id, label);
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

  return updateEnquiryAtIndex(enquiries, index, (current) => ({
    ...current,
    status,
    suggestedNextAction: suggestedActionForStatus(status),
    timeline: appendTimeline(current, timelineLabel),
  }));
}

export function bookEnquirySiteVisit(
  id: string,
  booking: SiteVisitBookingInput
): StoredEnquiry | null {
  const enquiries = readEnquiries();
  const index = enquiries.findIndex((enquiry) => enquiry.id === id);

  if (index === -1) {
    return null;
  }

  const timelineLabel = formatTimelineSiteVisitBooked(booking.confirmationLine);
  const linkTimelineLabel = formatTimelineCustomerConfirmationLinkCreated();
  const updated = updateEnquiryAtIndex(enquiries, index, (entry) => {
    let timeline = entry.timeline;

    if (!enquiryHasTimelineLabel(entry, timelineLabel)) {
      timeline = appendTimeline({ ...entry, timeline }, timelineLabel);
    }

    const withSiteVisit = { ...entry, timeline };

    if (!enquiryHasTimelineLabel(withSiteVisit, linkTimelineLabel)) {
      timeline = appendTimeline(withSiteVisit, linkTimelineLabel);
    }

    return {
      ...entry,
      status: "site_visit_booked",
      siteVisitSlot: booking.slotLabel,
      siteVisitStartsAt: booking.startsAt,
      suggestedNextAction: suggestedActionForStatus("site_visit_booked"),
      timeline,
    };
  });

  upsertSiteVisitCalendarEvent(updated, {
    slotLabel: booking.slotLabel,
    dateIso: booking.dateIso,
    startsAt: booking.startsAt,
  });

  return updated;
}

export function declineStoredEnquiry(id: string): StoredEnquiry | null {
  return updateStoredEnquiryStatus(
    id,
    "declined",
    formatTimelineEnquiryDeclined()
  );
}

export async function deleteStoredEnquiry(id: string): Promise<boolean> {
  const enquiries = readEnquiries();
  const index = enquiries.findIndex((enquiry) => enquiry.id === id);

  if (index === -1) {
    return false;
  }

  const [removed] = enquiries.splice(index, 1);
  writeEnquiries(enquiries);

  const photoIds = removed.photos.map((photo) => photo.id);
  clearSessionPhotosForEnquiry(id, photoIds);
  await deleteEnquiryPhotoBlobs(id, photoIds);
  removeSiteVisitCalendarEventsForEnquiry(id);

  return true;
}
