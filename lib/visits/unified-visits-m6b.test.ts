import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildQuotePreparationPath } from "@/lib/proposals/quote-preparation/quote-preparation-path";
import { buildQuotePreparationDraft } from "@/lib/proposals/quote-preparation/build-quote-draft";
import { shouldUseVisitCaptureQuotePreparation } from "@/components/proposals/quote-preparation-entry";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import type { SiteVisitSession } from "@/lib/site-visit/types";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function sampleEnquiry(overrides: Partial<StoredEnquiry> = {}): StoredEnquiry {
  return {
    id: "enq-1",
    status: "site_visit_completed",
    receivedAt: "2026-11-03T10:00:00.000Z",
    serviceRequested: "Decorating",
    customerName: "Charlie",
    customerMobile: "07700900603",
    customerEmail: "charlie@example.test",
    addressLine1: "8 Capture Court",
    addressLine2: "",
    city: "Leeds",
    county: "",
    postcode: "LS3 3CC",
    propertyType: "House",
    projectDescription: "Living room",
    photoCount: 0,
    photos: [],
    hasMeasurements: false,
    measurements: [],
    tradeAnswers: [],
    tradespersonBusiness: "Test Trade",
    tradespersonPhone: "",
    tradespersonEmail: "",
    suggestedNextAction: "Prepare quote",
    siteVisitSlot: "Initial slot",
    siteVisitStartsAt: "2026-12-03T10:00:00.000Z",
    linkedProposalDraftId: null,
    linkedProposalId: null,
    timeline: [],
    ...overrides,
  };
}

function sampleSession(overrides: Partial<SiteVisitSession> = {}): SiteVisitSession {
  return {
    enquiryId: "enq-1",
    visitId: "visit-follow",
    slotLabel: "Follow-up Thu 12:00",
    startsAt: "2026-12-10T12:00:00.000Z",
    startedAt: "2026-12-10T12:00:00.000Z",
    completedAt: "2026-12-10T13:00:00.000Z",
    voiceNotes: [],
    photos: [{ id: "p1", name: "follow.png", capturedAt: "2026-12-10T12:30:00.000Z" }],
    measurements: [
      { id: "length", label: "Length", value: "4.2", unit: "m" },
    ],
    notes: "FOLLOW-UP notes only",
    checklist: [],
    ...overrides,
  };
}

describe("unified visits milestone 6B proposal handoff", () => {
  it("builds Prepare Quote paths with the selected visitId", () => {
    expect(buildQuotePreparationPath("enq-1", "visit-2")).toContain("visitId=visit-2");
    expect(readRepo("components/site-visit/site-visit-mode-view.tsx")).toContain(
      "buildQuotePreparationPath(enquiryId, visitId)"
    );
  });

  it("routes enquiry+visit handoff through capture Prepare Quote", () => {
    expect(
      shouldUseVisitCaptureQuotePreparation({
        enquiryId: "enq-1",
        visitId: "visit-2",
      })
    ).toBe(true);
    expect(readRepo("app/(workspace)/proposals/new/page.tsx")).toContain(
      "visitEnquiryId"
    );
    expect(readRepo("components/proposals/quote-preparation-form.tsx")).toContain(
      "getSiteVisitForEnquiryAction(enquiryId, selectedVisitId)"
    );
  });

  it("loads capture notes and measurements for the selected visit only", () => {
    const draft = buildQuotePreparationDraft(sampleEnquiry(), sampleSession());
    expect(draft.siteDetails.join("\n")).toContain("FOLLOW-UP notes only");
    expect(draft.siteDetails.join("\n")).not.toContain("INITIAL");
    expect(draft.measurementsText).toContain("Length: 4.2 m");
    expect(draft.photoCount).toBe(1);
    expect(draft.siteVisitDate.toLowerCase()).toMatch(/december|10/);
  });

  it("does not invent another visit's capture when session is missing", () => {
    const draft = buildQuotePreparationDraft(sampleEnquiry(), null);
    expect(draft.siteDetails.join("\n")).not.toContain("FOLLOW-UP");
    expect(draft.photoCount).toBe(0);
  });

  it("verifies visit ownership before loading a visit-scoped capture", () => {
    const actions = readRepo("lib/enquiries/server/actions.ts");
    const block = actions.slice(
      actions.indexOf("export async function getSiteVisitForEnquiryAction"),
      actions.indexOf("export async function listEnquiryVisitsAction")
    );
    expect(block).toContain('eq("id", visitId)');
    expect(block).toContain('eq("workspace_id", context.workspaceId)');
    expect(block).toContain("does not belong to this enquiry");
    expect(block).toContain("do not fall back");
  });
});
