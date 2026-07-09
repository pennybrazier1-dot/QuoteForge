import type {
  SiteVisitOrganisingStep,
  SiteVisitSession,
} from "@/lib/site-visit/types";

export const DEFAULT_SITE_VISIT_CHECKLIST = [
  { id: "access", label: "Work area is accessible", checked: false },
  { id: "scope", label: "Scope discussed with customer", checked: false },
  { id: "hazards", label: "Access or safety notes captured", checked: false },
  { id: "next-step", label: "Next step agreed with customer", checked: false },
] as const;

export const DEFAULT_SITE_VISIT_MEASUREMENTS = [
  { id: "length", label: "Length", value: "", unit: "m" },
  { id: "width", label: "Width", value: "", unit: "m" },
  { id: "height", label: "Height", value: "", unit: "m" },
] as const;

export function createDefaultSiteVisitSession(enquiryId: string): SiteVisitSession {
  return {
    enquiryId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    voiceNotes: [],
    photos: [],
    measurements: DEFAULT_SITE_VISIT_MEASUREMENTS.map((field) => ({ ...field })),
    notes: "",
    checklist: DEFAULT_SITE_VISIT_CHECKLIST.map((item) => ({ ...item })),
  };
}

export function formatVisitElapsed(
  startedAt: string,
  now = Date.now()
): string {
  const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

export function hasMeasurementValues(session: SiteVisitSession): boolean {
  return session.measurements.some((field) => field.value.trim().length > 0);
}

export function hasCompletedChecklist(session: SiteVisitSession): boolean {
  return (
    session.checklist.length > 0 &&
    session.checklist.every((item) => item.checked)
  );
}

export function getSiteVisitOrganisingSteps(
  session: SiteVisitSession,
  visitCompleted: boolean
): SiteVisitOrganisingStep[] {
  return [
    {
      id: "notes",
      label: "Notes organised",
      done: session.notes.trim().length > 0,
    },
    {
      id: "photos",
      label: "Photos organised",
      done: session.photos.length > 0,
    },
    {
      id: "measurements",
      label: "Measurements organised",
      done: hasMeasurementValues(session),
    },
    {
      id: "quote",
      label: "Quote information prepared",
      done: visitCompleted,
    },
  ];
}

export function isSiteVisitOrganisingComplete(
  steps: SiteVisitOrganisingStep[]
): boolean {
  return steps.every((step) => step.done);
}

export function canAccessSiteVisitMode(status: string): boolean {
  return status === "site_visit_booked" || status === "site_visit_completed";
}
