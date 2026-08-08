import { describe, expect, it } from "vitest";
import {
  buildCreateQuoteFromVisitHref,
  buildProposalInitialValuesFromVisit,
  buildVisitQuoteSiteNotes,
} from "@/lib/visits/quote-handoff";
import type { VisitRecord } from "@/lib/visits/types";

function sampleVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    id: "visit-1",
    workspace_id: "ws-1",
    customer_id: "cust-1",
    enquiry_id: "enq-1",
    customer_name: "Alex Customer",
    contact_phone: "07700 900123",
    contact_email: "alex@example.com",
    address_line_1: "12 High Street",
    address_line_2: "",
    town: "Leeds",
    county: "",
    postcode: "LS1 1AA",
    enquiry_summary: "Kitchen assessment needed",
    visit_type: "initial_assessment",
    visit_date: "2026-08-10",
    visit_time: "09:30",
    duration_minutes: 60,
    status: "scheduled",
    notes: "Width 3200mm, side gate access",
    linked_proposal_id: null,
    created_at: "2026-08-08T10:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("visit quote handoff", () => {
  it("builds combined site notes from summary and visit notes", () => {
    const notes = buildVisitQuoteSiteNotes(sampleVisit());
    expect(notes).toMatch(/Enquiry summary/i);
    expect(notes).toMatch(/Kitchen assessment/i);
    expect(notes).toMatch(/Visit notes/i);
    expect(notes).toMatch(/3200mm/i);
  });

  it("maps visit fields into proposal initial values", () => {
    const initial = buildProposalInitialValuesFromVisit(sampleVisit());
    expect(initial.customerName).toBe("Alex Customer");
    expect(initial.phoneNumber).toBe("07700 900123");
    expect(initial.emailAddress).toBe("alex@example.com");
    expect(initial.propertyAddress).toMatch(/12 High Street/);
    expect(initial.jobDescription).toMatch(/Visit notes/i);
  });

  it("builds create-quote path with visit id", () => {
    expect(buildCreateQuoteFromVisitHref("visit-1")).toBe(
      "/proposals/new?visitId=visit-1"
    );
  });
});
