import { describe, expect, it } from "vitest";
import {
  QuotePreparationEntry,
  shouldUseQuotePreparation,
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

  it("routes to Prepare Quote only when enquiryId is present", () => {
    expect(shouldUseQuotePreparation("enquiry-1")).toBe(true);
    expect(shouldUseQuotePreparation("  enquiry-1  ")).toBe(true);
  });
});
