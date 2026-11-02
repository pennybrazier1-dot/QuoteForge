import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  QUOTE_PREPARATION_CREATE_BUTTON,
  QUOTE_PREPARATION_CREATE_HINT,
} from "@/lib/proposals/quote-preparation/types";

describe("prepare quote create proposal wiring", () => {
  it("exposes create-proposal copy for the sticky CTA", () => {
    expect(QUOTE_PREPARATION_CREATE_BUTTON).toBe("Create proposal");
    expect(QUOTE_PREPARATION_CREATE_HINT.toLowerCase()).toContain("official");
    expect(QUOTE_PREPARATION_CREATE_HINT.toLowerCase()).toContain("send");
  });

  it("wires QuotePreparationForm to createProposalFromPreparedQuote", () => {
    const source = readFileSync(
      "components/proposals/quote-preparation-form.tsx",
      "utf8"
    );
    expect(source).toContain("createProposalFromPreparedQuote");
    expect(source).toContain("QUOTE_PREPARATION_CREATE_BUTTON");
    expect(source).toContain('name="generatedProposal"');
    expect(source).toContain('name="enquiryId"');
  });

  it("adds Enquiries to the mobile More menu", () => {
    const source = readFileSync("app/(workspace)/more/page.tsx", "utf8");
    expect(source).toContain('href: "/enquiries"');
    expect(source).toContain('title: "Enquiries"');
  });

  it("uses a real Link for Review Enquiry on enquiry cards", () => {
    const source = readFileSync("components/enquiries/enquiry-card.tsx", "utf8");
    expect(source).toContain("Review Enquiry");
    expect(source).toContain("enquiryDetailHref");
    expect(source).not.toContain("markEnquiryReviewing(");
    expect(source).not.toContain("router.push");
  });
});
