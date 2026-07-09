import { describe, expect, it } from "vitest";
import {
  buildSiteVisitConfirmationMessage,
  buildSiteVisitOutreachMessage,
  getCustomerFirstName,
} from "@/lib/enquiries/site-visit-messages";

describe("site visit messages", () => {
  it("uses the first name in outreach and confirmation messages", () => {
    expect(getCustomerFirstName("Sarah Johnson")).toBe("Sarah");
    expect(buildSiteVisitOutreachMessage("Sarah Johnson")).toContain("Hi Sarah");
    expect(buildSiteVisitConfirmationMessage(
      "Sarah Johnson",
      "Smith Plumbing",
      "Thursday at 9:30"
    )).toBe(
      "Hi Sarah, your site visit with Smith Plumbing is booked for Thursday at 9:30. Please make sure the work area is accessible."
    );
  });

  it("falls back when the customer name is missing", () => {
    expect(buildSiteVisitOutreachMessage("")).toContain("Hi there");
  });
});
