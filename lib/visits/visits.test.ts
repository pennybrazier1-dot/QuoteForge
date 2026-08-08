import { describe, expect, it } from "vitest";
import { extractVisitNotes } from "@/lib/visits/extract-visit-notes";
import { buildCalendarJobsFromVisits } from "@/lib/visits/calendar";
import {
  formatVisitDuration,
  formatVisitStatus,
  formatVisitType,
  type VisitRecord,
} from "@/lib/visits/types";

function sampleVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    id: "visit-1",
    workspace_id: "ws-1",
    customer_id: "cust-1",
    enquiry_id: null,
    customer_name: "Alex Customer",
    contact_phone: "07700 900123",
    contact_email: "alex@example.com",
    address_line_1: "12 High Street",
    address_line_2: "",
    town: "Leeds",
    county: "",
    postcode: "LS1 1AA",
    enquiry_summary: "Kitchen assessment",
    visit_type: "initial_assessment",
    visit_date: "2026-08-10",
    visit_time: "09:30",
    duration_minutes: 60,
    status: "scheduled",
    notes: "",
    created_at: "2026-08-08T10:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("visit helpers", () => {
  it("formats visit type and status labels", () => {
    expect(formatVisitType("initial_assessment")).toBe("Initial assessment");
    expect(formatVisitType("measure_up")).toBe("Measure up");
    expect(formatVisitStatus("scheduled")).toBe("Scheduled");
    expect(formatVisitDuration(90)).toBe("1h 30m");
  });

  it("maps visits into calendar jobs with visit hrefs", () => {
    const jobs = buildCalendarJobsFromVisits([sampleVisit()]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.href).toBe("/visits/visit-1");
    expect(jobs[0]?.tone).toBe("site_visit");
    expect(jobs[0]?.badgeLabel).toBe("Initial assessment");
    expect(jobs[0]?.customer).toBe("Alex Customer");
  });

  it("extracts structured notes from free text", () => {
    const extract = extractVisitNotes(
      [
        "Width 3200mm by 1800mm height",
        "Parking on street, access via side gate",
        "Customer prefers grey tiles",
        "Return with quote next week",
      ].join("\n")
    );

    expect(extract.measurements).toMatch(/3200mm/i);
    expect(extract.accessNotes).toMatch(/gate/i);
    expect(extract.materialsNotes).toMatch(/tiles/i);
    expect(extract.followUpNotes).toMatch(/quote/i);
  });
});
