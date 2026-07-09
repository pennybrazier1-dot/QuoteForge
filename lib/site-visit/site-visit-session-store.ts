"use client";

import { appendEnquiryTimelineEvent } from "@/lib/enquiries/enquiry-store";
import {
  formatTimelineSiteVisitChecklistCompleted,
  formatTimelineSiteVisitChecklistUpdated,
  formatTimelineSiteVisitMeasurementsRecorded,
  formatTimelineSiteVisitNotesAdded,
  formatTimelineSiteVisitPhotoAdded,
  formatTimelineSiteVisitStarted,
  formatTimelineSiteVisitVoiceNoteCaptured,
} from "@/lib/enquiries/timeline-messages";
import {
  createDefaultSiteVisitSession,
  hasCompletedChecklist,
  hasMeasurementValues,
} from "@/lib/site-visit/site-visit-mode-data";
import type {
  SiteVisitChecklistItem,
  SiteVisitMeasurement,
  SiteVisitSession,
} from "@/lib/site-visit/types";

const STORAGE_KEY = "quoteforge:site-visit-sessions";
const UPDATED_EVENT = "quoteforge:site-visit-sessions-updated";

export const EMPTY_SITE_VISIT_SESSIONS: SiteVisitSession[] = [];

let sessionsSnapshot: SiteVisitSession[] = EMPTY_SITE_VISIT_SESSIONS;
let sessionsSnapshotKey = "";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readSessions(): SiteVisitSession[] {
  if (!isBrowser()) {
    return EMPTY_SITE_VISIT_SESSIONS;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY) ?? "[]";

  if (raw === sessionsSnapshotKey) {
    return sessionsSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    sessionsSnapshot = Array.isArray(parsed)
      ? parsed.filter((entry): entry is SiteVisitSession => {
          return (
            !!entry &&
            typeof entry === "object" &&
            typeof (entry as SiteVisitSession).enquiryId === "string"
          );
        })
      : EMPTY_SITE_VISIT_SESSIONS;
  } catch {
    sessionsSnapshot = EMPTY_SITE_VISIT_SESSIONS;
  }

  sessionsSnapshotKey = raw;
  return sessionsSnapshot;
}

function writeSessions(sessions: SiteVisitSession[]): void {
  if (!isBrowser()) {
    return;
  }

  const payload = JSON.stringify(sessions);
  window.localStorage.setItem(STORAGE_KEY, payload);
  sessionsSnapshot = sessions;
  sessionsSnapshotKey = payload;
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

function updateSession(
  enquiryId: string,
  updater: (current: SiteVisitSession) => SiteVisitSession
): SiteVisitSession {
  const sessions = readSessions();
  const index = sessions.findIndex((session) => session.enquiryId === enquiryId);
  const current =
    index === -1 ? createDefaultSiteVisitSession(enquiryId) : sessions[index];
  const updated = updater(current);
  const nextSessions = [...sessions];

  if (index === -1) {
    nextSessions.push(updated);
  } else {
    nextSessions[index] = updated;
  }

  writeSessions(nextSessions);
  return updated;
}

export function subscribeToSiteVisitSessions(
  listener: () => void
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const handleUpdate = () => listener();
  window.addEventListener(UPDATED_EVENT, handleUpdate);
  window.addEventListener("storage", handleUpdate);

  return () => {
    window.removeEventListener(UPDATED_EVENT, handleUpdate);
    window.removeEventListener("storage", handleUpdate);
  };
}

export function getSiteVisitSession(
  enquiryId: string
): SiteVisitSession | null {
  return readSessions().find((session) => session.enquiryId === enquiryId) ?? null;
}

export function ensureSiteVisitSession(enquiryId: string): SiteVisitSession {
  const existing = getSiteVisitSession(enquiryId);

  if (existing) {
    return existing;
  }

  const created = createDefaultSiteVisitSession(enquiryId);
  writeSessions([...readSessions(), created]);
  appendEnquiryTimelineEvent(enquiryId, formatTimelineSiteVisitStarted());
  return created;
}

export function removeSiteVisitSession(enquiryId: string): void {
  const sessions = readSessions().filter(
    (session) => session.enquiryId !== enquiryId
  );
  writeSessions(sessions);
}

export function markSiteVisitSessionCompleted(enquiryId: string): void {
  updateSession(enquiryId, (session) => ({
    ...session,
    completedAt: new Date().toISOString(),
  }));
}

export function addSiteVisitVoiceNote(enquiryId: string): SiteVisitSession {
  const session = updateSession(enquiryId, (current) => ({
    ...current,
    voiceNotes: [
      {
        id: crypto.randomUUID(),
        label: "Voice note captured on site",
        capturedAt: new Date().toISOString(),
        durationSeconds: 42,
      },
      ...current.voiceNotes,
    ],
  }));

  appendEnquiryTimelineEvent(
    enquiryId,
    formatTimelineSiteVisitVoiceNoteCaptured()
  );
  return session;
}

export function addSiteVisitPhoto(
  enquiryId: string,
  name: string
): SiteVisitSession {
  const session = updateSession(enquiryId, (current) => ({
    ...current,
    photos: [
      {
        id: crypto.randomUUID(),
        name,
        capturedAt: new Date().toISOString(),
      },
      ...current.photos,
    ],
  }));

  appendEnquiryTimelineEvent(enquiryId, formatTimelineSiteVisitPhotoAdded());
  return session;
}

export function updateSiteVisitMeasurements(
  enquiryId: string,
  measurements: SiteVisitMeasurement[]
): SiteVisitSession {
  const previous = getSiteVisitSession(enquiryId);
  const session = updateSession(enquiryId, (current) => ({
    ...current,
    measurements,
  }));

  if (
    hasMeasurementValues(session) &&
    !hasMeasurementValues(
      previous ?? createDefaultSiteVisitSession(enquiryId)
    )
  ) {
    appendEnquiryTimelineEvent(
      enquiryId,
      formatTimelineSiteVisitMeasurementsRecorded()
    );
  }

  return session;
}

export function updateSiteVisitNotes(
  enquiryId: string,
  notes: string
): SiteVisitSession {
  const previous = getSiteVisitSession(enquiryId);
  const session = updateSession(enquiryId, (current) => ({
    ...current,
    notes,
  }));

  if (
    notes.trim().length > 0 &&
    !(previous?.notes.trim().length ?? 0)
  ) {
    appendEnquiryTimelineEvent(enquiryId, formatTimelineSiteVisitNotesAdded());
  }

  return session;
}

export function updateSiteVisitChecklist(
  enquiryId: string,
  checklist: SiteVisitChecklistItem[]
): SiteVisitSession {
  const session = updateSession(enquiryId, (current) => ({
    ...current,
    checklist,
  }));

  appendEnquiryTimelineEvent(
    enquiryId,
    formatTimelineSiteVisitChecklistUpdated()
  );

  if (hasCompletedChecklist(session)) {
    appendEnquiryTimelineEvent(
      enquiryId,
      formatTimelineSiteVisitChecklistCompleted()
    );
  }

  return session;
}
