import { describe, expect, it } from "vitest";
import {
  buildQuickQuoteOptionalExtras,
  createEmptyPrepNotes,
  getQuickQuoteMissingWarnings,
  shouldSuggestSiteVisitForMeasurements,
  sumQuickQuoteCosts,
} from "@/lib/proposals/quick-quote-preparation";

describe("quick quote preparation helpers", () => {
  it("builds a soft quote readiness list from empty prep fields", () => {
    const warnings = getQuickQuoteMissingWarnings({
      notes: createEmptyPrepNotes(),
      durationValue: "",
      plannedStartDateText: "",
      plannedStartDateExact: "",
    });

    expect(warnings.map((item) => item.label)).toEqual([
      "Measurements to confirm",
      "Materials to confirm",
      "Access requirements to confirm",
      "Duration to confirm",
      "Start date to confirm",
    ]);
    expect(
      warnings.every((item) => item.detail.toLowerCase().includes("later"))
    ).toBe(true);
  });

  it("clears readiness items when prep fields are filled", () => {
    const warnings = getQuickQuoteMissingWarnings({
      notes: {
        measurements: "3.2m wall",
        materialsRequired: "Grey tiles",
        accessRequirements: "Side gate only",
        additionalNotes: "",
      },
      durationValue: "2",
      plannedStartDateText: "week commencing 18 September",
      plannedStartDateExact: "",
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
});
