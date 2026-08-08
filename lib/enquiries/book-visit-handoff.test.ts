import { describe, expect, it } from "vitest";
import {
  buildBookVisitFromEnquiryHref,
  buildCreateQuoteFromEnquiryHref,
  formatEnquiryCustomerAddress,
} from "@/lib/enquiries/book-visit-handoff";

describe("enquiry visit handoff", () => {
  it("builds the book-visit path with enquiry id", () => {
    expect(buildBookVisitFromEnquiryHref("enq-123")).toBe(
      "/visits/new?enquiryId=enq-123"
    );
  });

  it("builds the create-quote path with enquiry id", () => {
    expect(buildCreateQuoteFromEnquiryHref("enq-123")).toBe(
      "/proposals/new?enquiryId=enq-123"
    );
  });

  it("formats a full customer address", () => {
    expect(
      formatEnquiryCustomerAddress({
        addressLine1: "12 Oak Street",
        addressLine2: "",
        city: "Northampton",
        county: "Northamptonshire",
        postcode: "NN1 1AA",
      })
    ).toBe("12 Oak Street, Northampton, Northamptonshire, NN1 1AA");
  });
});
