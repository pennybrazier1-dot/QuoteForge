import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildQuotePreparationDraft,
  buildQuotePreparationDraftSafe,
} from "@/lib/proposals/quote-preparation/build-quote-draft";
import { QUOTE_PREPARATION_REVIEW_NOTICE } from "@/lib/proposals/quote-preparation/types";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import type { SiteVisitSession } from "@/lib/site-visit/types";

function sampleEnquiry(): StoredEnquiry {
  return {
    id: "enquiry-1",
    status: "site_visit_completed",
    receivedAt: "2026-07-09T12:00:00.000Z",
    customerName: "Jane Smith",
    customerMobile: "07700 900123",
    customerEmail: "jane@example.com",
    serviceRequested: "Plumbing",
    addressLine1: "12 Oak Street",
    addressLine2: "",
    city: "Northampton",
    county: "Northamptonshire",
    postcode: "NN1 1AA",
    propertyType: "House",
    projectDescription: "Fix a leaking kitchen tap.",
    photoCount: 2,
    photos: [],
    hasMeasurements: false,
    measurements: [],
    tradeAnswers: [
      {
        questionId: "plumbing_type",
        question: "Type of plumbing work",
        answer: "Leak or repair",
      },
    ],
    tradespersonBusiness: "John's Plumbing",
    tradespersonPhone: "07700 900 456",
    tradespersonEmail: "",
    suggestedNextAction: "Prepare quote",
    siteVisitSlot: "Thursday 09:30",
    siteVisitStartsAt: "2026-07-10T08:30:00.000Z",
    linkedProposalDraftId: null,
    timeline: [],
  };
}

function sampleSession(): SiteVisitSession {
  return {
    enquiryId: "enquiry-1",
    startedAt: "2026-07-10T08:00:00.000Z",
    completedAt: "2026-07-10T09:00:00.000Z",
    voiceNotes: [
      {
        id: "voice-1",
        label: "Voice note captured on site",
        capturedAt: "2026-07-10T08:15:00.000Z",
        durationSeconds: 42,
      },
    ],
    photos: [{ id: "photo-1", name: "kitchen.jpg", capturedAt: "2026-07-10T08:20:00.000Z" }],
    measurements: [
      { id: "length", label: "Length", value: "2.4", unit: "m" },
      { id: "width", label: "Width", value: "", unit: "m" },
    ],
    notes: "Leak under the sink. Tight access.",
    checklist: [
      { id: "access", label: "Work area is accessible", checked: true },
      { id: "scope", label: "Scope discussed with customer", checked: false },
    ],
  };
}

describe("buildQuotePreparationDraft", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("labour-1")
        .mockReturnValueOnce("cost-1")
        .mockReturnValueOnce("cost-2")
        .mockReturnValueOnce("cost-3")
        .mockReturnValueOnce("cost-4")
        .mockReturnValueOnce("material-1")
        .mockReturnValueOnce("material-2"),
    });
  });

  it("prefills customer and property details from the enquiry", () => {
    const draft = buildQuotePreparationDraft(sampleEnquiry(), sampleSession());

    expect(draft.customerName).toBe("Jane Smith");
    expect(draft.propertyAddress).toContain("12 Oak Street");
    expect(draft.phoneNumber).toBe("07700 900123");
    expect(draft.emailAddress).toBe("jane@example.com");
    expect(draft.reviewNotice).toBe(QUOTE_PREPARATION_REVIEW_NOTICE);
  });

  it("includes site visit notes, measurements, and structured work items", () => {
    const draft = buildQuotePreparationDraft(sampleEnquiry(), sampleSession());

    expect(draft.jobDescription).toContain("Leak under the sink");
    expect(draft.jobDescription).toContain("Voice note captured on site");
    expect(draft.measurementsText).toContain("Length: 2.4 m");
    expect(draft.scopeItems).toEqual(
      expect.arrayContaining([
        "Plumbing",
        "Type of plumbing work: Leak or repair",
      ])
    );
    expect(draft.siteDetails).toEqual(
      expect.arrayContaining([
        "Visit notes: Leak under the sink. Tight access.",
        "Checklist: Work area is accessible",
      ])
    );
  });

  it("never invents prices in the generated draft", () => {
    const draft = buildQuotePreparationDraft(sampleEnquiry(), sampleSession());

    expect(draft.total).toBe("");
    expect(draft.subtotal).toBe("");
    expect(draft.materials.every((item) => item.price === "")).toBe(true);
    expect(draft.labourItems.every((item) => item.rate === "")).toBe(true);
  });

  it("loads safely when site visit data is incomplete", () => {
    const draft = buildQuotePreparationDraftSafe(sampleEnquiry(), {
      enquiryId: "enquiry-1",
      startedAt: "bad",
      completedAt: null,
      voiceNotes: null as unknown as SiteVisitSession["voiceNotes"],
      photos: undefined as unknown as SiteVisitSession["photos"],
      measurements: undefined as unknown as SiteVisitSession["measurements"],
      notes: "",
      checklist: undefined as unknown as SiteVisitSession["checklist"],
    });

    expect(draft?.customerName).toBe("Jane Smith");
    expect(draft?.scopeItems.length).toBeGreaterThan(0);
  });

  it("returns null when enquiry is missing", () => {
    expect(buildQuotePreparationDraftSafe(null, null)).toBeNull();
  });
});
