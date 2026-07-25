import { describe, expect, it } from "vitest";
import {
  draftHasInventedPrices,
  getQuoteMissingChecks,
} from "@/lib/proposals/quote-preparation/missing-checks";
import { QUOTE_PREPARATION_REVIEW_NOTICE } from "@/lib/proposals/quote-preparation/types";
import type { QuotePreparationDraft } from "@/lib/proposals/quote-preparation/types";

function emptyDraft(): QuotePreparationDraft {
  return {
    enquiryId: "enquiry-1",
    siteVisitSessionId: "enquiry-1",
    customerId: null,
    sourceType: "site-visit",
    reviewNotice: QUOTE_PREPARATION_REVIEW_NOTICE,
    customerName: "Jane Smith",
    propertyAddress: "12 Oak Street",
    phoneNumber: "07700 900123",
    emailAddress: "jane@example.com",
    jobDescription: "Site notes",
    scopeSummary: "Plumbing repair",
    scopeItems: ["Replace tap"],
    siteDetails: [],
    measurementsText: "",
    materials: [{ id: "m1", description: "Draft suggestion: tap", suggested: true, price: "" }],
    labourItems: [
      {
        id: "l1",
        description: "Labour",
        quantity: "",
        rate: "",
        lineTotal: "",
      },
    ],
    additionalCosts: [],
    notesAndExclusions: "",
    assumptions: [],
    thingsToConfirm: [],
    validityPeriod: "30 days",
    expectedTimescale: "",
    vatEnabled: false,
    vatRate: "20",
    subtotal: "",
    vatAmount: "",
    total: "",
    estimatedDuration: "",
    plannedStartDateText: "",
    plannedStartDateExact: "",
    photoCount: 1,
    siteVisitDate: "Thursday 09:30",
  };
}

describe("quote missing checks", () => {
  it("flags missing labour, materials, VAT, timescale, and measurements", () => {
    const checks = getQuoteMissingChecks(emptyDraft());

    expect(checks.map((check) => check.label)).toEqual([
      "Labour estimate",
      "Material prices",
      "VAT treatment",
      "Start date or timescale",
      "Any missing measurements",
    ]);
  });

  it("clears checks when the trader fills the draft", () => {
    const draft = {
      ...emptyDraft(),
      measurementsText: "Length: 2.4 m",
      expectedTimescale: "Start within 2 weeks",
      vatEnabled: true,
      materials: [{ id: "m1", description: "Tap", suggested: false, price: "45" }],
      labourItems: [
        {
          id: "l1",
          description: "Labour",
          quantity: "2",
          rate: "50",
          lineTotal: "100",
        },
      ],
    };

    expect(getQuoteMissingChecks(draft)).toEqual([]);
  });

  it("does not treat an empty draft as having invented prices", () => {
    expect(draftHasInventedPrices(emptyDraft())).toBe(false);
  });
});
