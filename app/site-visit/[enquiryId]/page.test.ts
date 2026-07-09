import { describe, expect, it } from "vitest";
import SiteVisitPage from "@/app/site-visit/[enquiryId]/page";

describe("site visit page route", () => {
  it("exports a page component for /site-visit/[enquiryId]", () => {
    expect(SiteVisitPage).toBeTypeOf("function");
  });
});
