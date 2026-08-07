import { describe, expect, it } from "vitest";
import {
  buildQuickQuoteOptionalExtras,
  buildQuickQuoteSiteNotesForGenerate,
  createEmptyPrepNotes,
  getQuickQuoteMissingWarnings,
  shouldSuggestSiteVisitForMeasurements,
  sumQuickQuoteCosts,
} from "@/lib/proposals/quick-quote-preparation";

describe("quick quote preparation helpers", () => {
  it("builds soft readiness warnings from empty prep fields", () => {
    const warnings = getQuickQuoteMissingWarnings({
      customerName: "",
      emailAddress: "",
      phoneNumber: "",
      propertyAddress: "",
      notes: createEmptyPrepNotes(),
      jobDescription: "",
      photoCount: 0,
      photosNotRequired: false,
      siteVisitCompleted: false,
      durationValue: "",
      plannedStartDateText: "",
      plannedStartDateExact: "",
      estimatedPrice: "",
      paymentTermsSupported: false,
    });

    expect(warnings.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "Customer contact details to confirm",
        "Measurements to confirm",
        "Photos/site conditions to confirm",
        "Site inspection to confirm",
        "Start date to confirm",
      ])
    );
    expect(
      warnings.every((item) => item.detail.toLowerCase().includes("later"))
    ).toBe(true);
  });

  it("clears readiness items when prep fields are filled", () => {
    const warnings = getQuickQuoteMissingWarnings({
      customerName: "Alex",
      emailAddress: "a@example.com",
      phoneNumber: "",
      propertyAddress: "1 High Street",
      notes: {
        measurements: "3.2m wall",
        materialsRequired: "Grey tiles",
        accessRequirements: "Side gate only",
        additionalNotes: "Chose grey",
      },
      jobDescription:
        "Full bathroom refit including suite, tiling, and waterproofing",
      photoCount: 0,
      photosNotRequired: true,
      siteVisitCompleted: true,
      durationValue: "2",
      plannedStartDateText: "week commencing 18 September",
      plannedStartDateExact: "",
      estimatedPrice: "950",
      paymentTermsSupported: false,
      aiNotesFirst: true,
    });

    expect(warnings).toEqual([]);
  });

  it("suggests a site visit when measurements are empty", () => {
    expect(
      shouldSuggestSiteVisitForMeasurements(createEmptyPrepNotes())
    ).toBe(true);
    expect(
      shouldSuggestSiteVisitForMeasurements({
        ...createEmptyPrepNotes(),
        measurements: "2.1 x 1.8",
      })
    ).toBe(false);
  });

  it("sums internal costs including profit/margin", () => {
    expect(sumQuickQuoteCosts("100", "250.50", "49.50", "100")).toBe("500");
    expect(sumQuickQuoteCosts("", "", "")).toBe("");
    expect(sumQuickQuoteCosts("abc", "10", "", "")).toBe("");
  });

  it("builds optional extras from prep notes only", () => {
    const notes = {
      measurements: "Bathroom 2.1 x 1.8",
      materialsRequired: "Grey tiles, suite pack",
      accessRequirements: "Park on road",
      additionalNotes: "Customer away mornings",
    };

    const text = buildQuickQuoteOptionalExtras({ notes });

    expect(text).toContain("Measurements / dimensions:");
    expect(text).toContain("Bathroom 2.1 x 1.8");
    expect(text).toContain("Materials required:");
    expect(text).toContain("Access requirements:");
    expect(text).toContain("Additional notes:");
    expect(text).not.toContain("£");
    expect(text).not.toContain("Still to confirm later");
    expect(text).not.toContain("site visit");
  });

  it("appends prep notes into site notes for AI, not optional extras", () => {
    const merged = buildQuickQuoteSiteNotesForGenerate({
      jobDescription: "Bathroom refit for Mrs Whitfield",
      notes: {
        measurements: "2.1 x 1.8",
        materialsRequired: "",
        accessRequirements: "Side gate",
        additionalNotes: "",
      },
    });

    expect(merged).toContain("Bathroom refit for Mrs Whitfield");
    expect(merged).toContain("Measurements / dimensions:");
    expect(merged).toContain("Access requirements:");
  });
});
