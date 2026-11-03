import { describe, expect, it } from "vitest";
import {
  QuotePreparationEntry,
  shouldUseQuotePreparation,
  shouldUseVisitCaptureQuotePreparation,
} from "@/components/proposals/quote-preparation-entry";

describe("quote preparation entry", () => {
  it("exports the entry component used by /proposals/new", () => {
    expect(QuotePreparationEntry).toBeTypeOf("function");
  });

  it("keeps the standard Supabase proposal path when enquiryId is missing", () => {
    expect(shouldUseQuotePreparation(undefined)).toBe(false);
    expect(shouldUseQuotePreparation("")).toBe(false);
    expect(shouldUseQuotePreparation("   ")).toBe(false);
  });

  it("routes to Prepare Quote when enquiryId is present", () => {
    expect(shouldUseQuotePreparation("enquiry-1")).toBe(true);
    expect(shouldUseQuotePreparation("  enquiry-1  ")).toBe(true);
  });

  it("uses visit-scoped capture Prepare Quote when both ids are present", () => {
    expect(
      shouldUseVisitCaptureQuotePreparation({
        enquiryId: "enquiry-1",
        visitId: "visit-2",
      })
    ).toBe(true);
  });

  it("keeps Quick Quote for calendar visits without an enquiry", () => {
    expect(
      shouldUseVisitCaptureQuotePreparation({
        enquiryId: null,
        visitId: "visit-2",
      })
    ).toBe(false);
    expect(shouldUseQuotePreparation(undefined)).toBe(false);
  });
});
