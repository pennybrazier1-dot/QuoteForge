"use client";

import { buildEnquiryFromJourney } from "@/lib/enquiries/build-enquiry";
import { buildPhotoMetadataFromFiles } from "@/lib/enquiries/photo-metadata";
import { parseStoredEnquiries } from "@/lib/enquiries/normalize-enquiry";
import { registerSessionPhotosFromFiles } from "@/lib/enquiries/photo-session-store";
import {
  EnquiryPersistError,
  isStorageQuotaError,
  toEnquiryPersistError,
} from "@/lib/enquiries/persist-errors";
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
    registerSessionPhotosFromFiles(enquiry.id, photos, formData.photos);
    const enquiries = readEnquiries();

    return writeEnquiryWithFallback(enquiry, enquiries);
  } catch (error) {
    throw toEnquiryPersistError(error);
  }
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

export function bookEnquirySiteVisit(
  id: string,
  slotLabel?: string
): StoredEnquiry | null {
  const enquiries = readEnquiries();
  const index = enquiries.findIndex((enquiry) => enquiry.id === id);

  if (index === -1) {
    return null;
  }

  const current = enquiries[index];
  const timelineLabel = slotLabel
    ? `Site visit booked (${slotLabel})`
    : "Site visit booked";
  const updated: StoredEnquiry = {
    ...current,
    status: "site_visit_booked",
    siteVisitSlot: slotLabel ?? current.siteVisitSlot,
    suggestedNextAction: suggestedActionForStatus("site_visit_booked"),
    timeline: appendTimeline(current, timelineLabel),
  };

  const nextEnquiries = [...enquiries];
  nextEnquiries[index] = updated;
  writeEnquiries(nextEnquiries);
  return updated;
}

export function declineStoredEnquiry(id: string): StoredEnquiry | null {
  return updateStoredEnquiryStatus(id, "declined", "Enquiry declined");
}
