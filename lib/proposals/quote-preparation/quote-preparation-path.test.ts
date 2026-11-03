import { describe, expect, it } from "vitest";
import { buildQuotePreparationPath } from "@/lib/proposals/quote-preparation/quote-preparation-path";

describe("quote preparation path", () => {
  it("opens prepare quote with the enquiry id query param", () => {
    expect(buildQuotePreparationPath("enquiry-1")).toBe(
      "/proposals/new?enquiryId=enquiry-1"
    );
  });

  it("includes visitId when preparing from a specific appointment", () => {
    expect(buildQuotePreparationPath("enquiry-1", "visit-9")).toBe(
      "/proposals/new?enquiryId=enquiry-1&visitId=visit-9"
    );
  });

  it("ignores blank visitId", () => {
    expect(buildQuotePreparationPath("enquiry-1", "  ")).toBe(
      "/proposals/new?enquiryId=enquiry-1"
    );
    expect(buildQuotePreparationPath("enquiry-1", null)).toBe(
      "/proposals/new?enquiryId=enquiry-1"
    );
  });
});
