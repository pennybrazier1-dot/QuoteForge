import { describe, expect, it } from "vitest";
import NewProposalPage from "@/app/(workspace)/proposals/new/page";
import { shouldUseQuotePreparation } from "@/components/proposals/quote-preparation-entry";

describe("new proposal page route", () => {
  it("exports a page component for /proposals/new", () => {
    expect(NewProposalPage).toBeTypeOf("function");
  });

  it("does not intercept a standard new proposal without enquiryId", () => {
    expect(shouldUseQuotePreparation(undefined)).toBe(false);
  });
});
