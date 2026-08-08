import { describe, expect, it } from "vitest";
import {
  analyzeChangeRequest,
  classifyChangeRequestLabels,
} from "@/lib/proposals/change-request/analyze-change-request";

describe("classifyChangeRequestLabels", () => {
  it("detects date requests", () => {
    expect(
      classifyChangeRequestLabels("Can we start next week instead of Monday?")
    ).toEqual(expect.arrayContaining(["date", "question"]));
  });

  it("detects scope and materials together", () => {
    expect(
      classifyChangeRequestLabels(
        "Please remove the tiling and use grey tiles instead."
      )
    ).toEqual(expect.arrayContaining(["scope", "materials"]));
  });

  it("detects price requests", () => {
    expect(
      classifyChangeRequestLabels("The price is too expensive for our budget.")
    ).toEqual(expect.arrayContaining(["price"]));
  });

  it("defaults to question when unclear", () => {
    expect(classifyChangeRequestLabels("Hello")).toEqual(["question"]);
  });
});

describe("analyzeChangeRequest", () => {
  it("suggests calendar for date-led requests", () => {
    const analysis = analyzeChangeRequest(
      "Please move the start date to Friday if possible."
    );
    expect(analysis.labels).toContain("date");
    expect(analysis.suggestedAction.key).toBe("check_calendar");
    expect(analysis.summary).toMatch(/timing|date/i);
  });

  it("suggests pricing review for price requests", () => {
    const analysis = analyzeChangeRequest(
      "Could you reduce the price a little?"
    );
    expect(analysis.suggestedAction.key).toBe("review_pricing");
  });

  it("never claims the proposal was changed", () => {
    const analysis = analyzeChangeRequest("Please add a towel rail.");
    expect(analysis.summary).not.toMatch(/updated the proposal|changed the price/i);
    expect(analysis.suggestedAction.label).toMatch(/Review|Reply|Check/i);
  });
});
