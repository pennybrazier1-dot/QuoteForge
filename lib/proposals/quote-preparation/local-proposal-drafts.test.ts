import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUOTE_PREPARATION_REVIEW_NOTICE } from "@/lib/proposals/quote-preparation/types";

const STORAGE_KEY = "quoteforge:proposal-drafts";
const ENQUIRIES_KEY = "quoteforge:enquiries";

function createLocalStorageMock() {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
  };
}

describe("local proposal drafts", () => {
  let localStorage = createLocalStorageMock();

  beforeEach(() => {
    localStorage = createLocalStorageMock();
    vi.stubGlobal("window", {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValue("draft-1"),
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a draft with enquiry linkage and draft status", async () => {
    const { saveLocalProposalDraft, getLocalProposalDraftByEnquiry } = await import(
      "@/lib/proposals/quote-preparation/local-proposal-drafts"
    );

    const saved = saveLocalProposalDraft({
      enquiryId: "enquiry-1",
      siteVisitSessionId: "enquiry-1",
      customerId: null,
      sourceType: "site-visit",
      reviewNotice: QUOTE_PREPARATION_REVIEW_NOTICE,
      customerName: "Jane Smith",
      propertyAddress: "12 Oak Street",
      phoneNumber: "",
      emailAddress: "",
      jobDescription: "Site notes",
      scopeSummary: "Plumbing",
      scopeItems: ["Replace tap"],
      siteDetails: [],
      measurementsText: "",
      materials: [],
      labourItems: [],
      additionalCosts: [],
      notesAndExclusions: "",
      assumptions: [],
      thingsToConfirm: [],
      validityPeriod: "",
      expectedTimescale: "",
      vatEnabled: false,
      vatRate: "20",
      subtotal: "",
      vatAmount: "",
      total: "",
      estimatedDuration: "",
      plannedStartDateText: "",
      plannedStartDateExact: "",
      photoCount: 0,
      siteVisitDate: "Thursday 09:30",
    });

    expect(saved).toMatchObject({
      id: "draft-1",
      enquiryId: "enquiry-1",
      sourceType: "site-visit",
      status: "draft",
    });
    expect(getLocalProposalDraftByEnquiry("enquiry-1")?.id).toBe("draft-1");
    expect(localStorage.getItem(STORAGE_KEY)).toContain("enquiry-1");
  });

  it("updates enquiry timeline and status when draft is saved", async () => {
    const { saveLocalProposalDraft } = await import(
      "@/lib/proposals/quote-preparation/local-proposal-drafts"
    );
    const { markEnquiryQuoteInPreparation, recordQuotePreparationStarted, getStoredEnquiry } =
      await import("@/lib/enquiries/enquiry-store");

    localStorage.setItem(
      ENQUIRIES_KEY,
      JSON.stringify([
        {
          id: "enquiry-1",
          status: "site_visit_completed",
          receivedAt: "2026-07-09T12:00:00.000Z",
          customerName: "Jane Smith",
          customerMobile: "",
          customerEmail: "",
          serviceRequested: "Plumbing",
          addressLine1: "12 Oak Street",
          addressLine2: "",
          city: "Northampton",
          county: "",
          postcode: "NN1 1AA",
          propertyType: "House",
          projectDescription: "Fix leak",
          photoCount: 0,
          photos: [],
          hasMeasurements: false,
          measurements: [],
          tradeAnswers: [],
          tradespersonBusiness: "John's Plumbing",
          tradespersonPhone: "",
          tradespersonEmail: "",
          suggestedNextAction: "",
          siteVisitSlot: "Thursday 09:30",
          siteVisitStartsAt: null,
          linkedProposalDraftId: null,
          timeline: [],
        },
      ])
    );

    recordQuotePreparationStarted("enquiry-1");
    const saved = saveLocalProposalDraft({
      enquiryId: "enquiry-1",
      siteVisitSessionId: "enquiry-1",
      customerId: null,
      sourceType: "site-visit",
      reviewNotice: QUOTE_PREPARATION_REVIEW_NOTICE,
      customerName: "Jane Smith",
      propertyAddress: "12 Oak Street",
      phoneNumber: "",
      emailAddress: "",
      jobDescription: "Site notes",
      scopeSummary: "Plumbing",
      scopeItems: ["Replace tap"],
      siteDetails: [],
      measurementsText: "",
      materials: [],
      labourItems: [],
      additionalCosts: [],
      notesAndExclusions: "",
      assumptions: [],
      thingsToConfirm: [],
      validityPeriod: "",
      expectedTimescale: "",
      vatEnabled: false,
      vatRate: "20",
      subtotal: "",
      vatAmount: "",
      total: "",
      estimatedDuration: "",
      plannedStartDateText: "",
      plannedStartDateExact: "",
      photoCount: 0,
      siteVisitDate: "Thursday 09:30",
    });
    markEnquiryQuoteInPreparation("enquiry-1", saved.id);

    const enquiry = getStoredEnquiry("enquiry-1");
    expect(enquiry?.status).toBe("quote_in_preparation");
    expect(enquiry?.linkedProposalDraftId).toBe("draft-1");
    expect(enquiry?.timeline.map((event) => event.label)).toEqual(
      expect.arrayContaining([
        "Quote preparation started.",
        "Draft quote saved.",
      ])
    );
  });

  it("does not load a draft linked to a different enquiry", async () => {
    const { saveLocalProposalDraft, getLocalProposalDraftByEnquiry } = await import(
      "@/lib/proposals/quote-preparation/local-proposal-drafts"
    );

    saveLocalProposalDraft({
      enquiryId: "enquiry-1",
      siteVisitSessionId: "enquiry-1",
      customerId: null,
      sourceType: "site-visit",
      reviewNotice: QUOTE_PREPARATION_REVIEW_NOTICE,
      customerName: "Jane Smith",
      propertyAddress: "12 Oak Street",
      phoneNumber: "",
      emailAddress: "",
      jobDescription: "Site notes",
      scopeSummary: "Plumbing",
      scopeItems: ["Replace tap"],
      siteDetails: [],
      measurementsText: "",
      materials: [],
      labourItems: [],
      additionalCosts: [],
      notesAndExclusions: "",
      assumptions: [],
      thingsToConfirm: [],
      validityPeriod: "",
      expectedTimescale: "",
      vatEnabled: false,
      vatRate: "20",
      subtotal: "",
      vatAmount: "",
      total: "",
      estimatedDuration: "",
      plannedStartDateText: "",
      plannedStartDateExact: "",
      photoCount: 0,
      siteVisitDate: "Thursday 09:30",
    });

    expect(getLocalProposalDraftByEnquiry("enquiry-2")).toBeNull();
    expect(getLocalProposalDraftByEnquiry("enquiry-1")?.enquiryId).toBe(
      "enquiry-1"
    );
  });

  it("ignores malformed localStorage without crashing", async () => {
    localStorage.setItem(STORAGE_KEY, "{not-json");
    const { getLocalProposalDrafts, getLocalProposalDraftByEnquiry } = await import(
      "@/lib/proposals/quote-preparation/local-proposal-drafts"
    );

    expect(getLocalProposalDrafts()).toEqual([]);
    expect(getLocalProposalDraftByEnquiry("enquiry-1")).toBeNull();
  });

  it("rejects mismatched draft payloads that point at another enquiry", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "draft-bad",
          enquiryId: "enquiry-1",
          siteVisitSessionId: null,
          customerId: null,
          sourceType: "site-visit",
          status: "draft",
          draft: {
            enquiryId: "enquiry-OTHER",
            siteVisitSessionId: null,
            customerId: null,
            sourceType: "site-visit",
            reviewNotice: QUOTE_PREPARATION_REVIEW_NOTICE,
            customerName: "Wrong",
            propertyAddress: "",
            phoneNumber: "",
            emailAddress: "",
            jobDescription: "",
            scopeSummary: "",
            scopeItems: [],
            siteDetails: [],
            measurementsText: "",
            materials: [],
            labourItems: [],
            additionalCosts: [],
            notesAndExclusions: "",
            assumptions: [],
            thingsToConfirm: [],
            validityPeriod: "",
            expectedTimescale: "",
            vatEnabled: false,
            vatRate: "20",
            subtotal: "",
            vatAmount: "",
            total: "",
            estimatedDuration: "",
            plannedStartDateText: "",
            plannedStartDateExact: "",
            photoCount: 0,
            siteVisitDate: "",
          },
          createdAt: "2026-07-10T00:00:00.000Z",
          savedAt: "2026-07-10T00:00:00.000Z",
        },
      ])
    );

    const { getLocalProposalDraftByEnquiry } = await import(
      "@/lib/proposals/quote-preparation/local-proposal-drafts"
    );

    expect(getLocalProposalDraftByEnquiry("enquiry-1")).toBeNull();
  });
});
