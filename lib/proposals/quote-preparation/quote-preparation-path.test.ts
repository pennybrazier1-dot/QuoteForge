import { describe, expect, it } from "vitest";
import { buildQuotePreparationPath } from "@/lib/proposals/quote-preparation/quote-preparation-path";

describe("quote preparation path", () => {
  it("opens prepare quote with the enquiry id query param", () => {
    expect(buildQuotePreparationPath("enquiry-1")).toBe(
      "/proposals/new?enquiryId=enquiry-1"
    );
  });
});
