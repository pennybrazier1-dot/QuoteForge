import { describe, expect, it } from "vitest";
import { extractOrganisedVisitNotes } from "@/lib/visits/extract-visit-notes";
import { buildCalendarJobsFromVisits } from "@/lib/visits/calendar";
import {
  parseVisitNotesOrganised,
} from "@/lib/visits/organise-visit-notes";
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

  it("extracts organised notes categories from free text", () => {
    const organised = extractOrganisedVisitNotes(
      [
        "Width 3200mm by 1800mm height",
        "Parking on street, access via side gate",
        "Customer prefers grey tiles",
        "Hoping to start next week",
        "Existing floor is uneven",
        "Need full kitchen refit",
      ].join("\n")
    );

    expect(organised.measurements).toMatch(/3200mm/i);
    expect(organised.access).toMatch(/gate/i);
    expect(organised.materials).toMatch(/tiles/i);
    expect(organised.customerChoices).toMatch(/prefers/i);
    expect(organised.timing).toMatch(/next week/i);
    expect(organised.siteConditions).toMatch(/uneven/i);
    expect(organised.requirements).toMatch(/refit/i);
  });

  it("parses AI organised note payloads safely", () => {
    const organised = parseVisitNotesOrganised({
      measurements: " 2.1m x 1.8m ",
      materials: "Grey tiles",
      access: "",
      siteConditions: null,
      requirements: "Refit bathroom",
      customerChoices: "White suite",
      timing: "Week commencing 18th",
      extra: "ignore",
    });

    expect(organised.measurements).toBe("2.1m x 1.8m");
    expect(organised.materials).toBe("Grey tiles");
    expect(organised.access).toBe("");
    expect(organised.siteConditions).toBe("");
    expect(organised.requirements).toBe("Refit bathroom");
    expect(organised.customerChoices).toBe("White suite");
    expect(organised.timing).toBe("Week commencing 18th");
  });
});
