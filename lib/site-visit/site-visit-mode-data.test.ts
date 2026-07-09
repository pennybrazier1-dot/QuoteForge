import { describe, expect, it } from "vitest";
import {
  canAccessSiteVisitMode,
  createDefaultSiteVisitSession,
  formatVisitElapsed,
  getSiteVisitOrganisingSteps,
} from "@/lib/site-visit/site-visit-mode-data";

describe("site visit mode data", () => {
  it("formats visit elapsed time", () => {
    const startedAt = new Date("2026-07-10T09:00:00.000Z").toISOString();
    const now = new Date("2026-07-10T09:05:30.000Z").getTime();

    expect(formatVisitElapsed(startedAt, now)).toBe("05:30");
  });

  it("builds organising steps from captured session data", () => {
    const session = {
      ...createDefaultSiteVisitSession("enquiry-1"),
      notes: "Leaking pipe under sink",
      photos: [{ id: "photo-1", name: "kitchen.jpg", capturedAt: "2026-07-10T09:01:00.000Z" }],
      measurements: [
        { id: "length", label: "Length", value: "2.4", unit: "m" },
        { id: "width", label: "Width", value: "", unit: "m" },
        { id: "height", label: "Height", value: "", unit: "m" },
      ],
    };

    const steps = getSiteVisitOrganisingSteps(session, false);

    expect(steps).toEqual([
      { id: "notes", label: "Notes organised", done: true },
      { id: "photos", label: "Photos organised", done: true },
      { id: "measurements", label: "Measurements organised", done: true },
      { id: "quote", label: "Quote information prepared", done: false },
    ]);
  });

  it("allows site visit mode for booked and completed enquiries", () => {
    expect(canAccessSiteVisitMode("site_visit_booked")).toBe(true);
    expect(canAccessSiteVisitMode("site_visit_completed")).toBe(true);
    expect(canAccessSiteVisitMode("reviewing")).toBe(false);
  });
});
