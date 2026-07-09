import { describe, expect, it } from "vitest";
import {
  buildCustomerJobPath,
  buildCustomerJobUrl,
  shouldShowCustomerJobLink,
} from "@/lib/enquiries/customer-job-link";
import type { StoredEnquiry } from "@/lib/enquiries/types";

function sampleEnquiry(
  status: StoredEnquiry["status"] = "new"
): StoredEnquiry {
  return {
    id: "enquiry-1",
    status,
    receivedAt: "2026-07-09T12:00:00.000Z",
    customerName: "Jane Smith",
    customerMobile: "07700 900123",
    customerEmail: "jane@example.com",
    serviceRequested: "Plumbing",
    addressLine1: "12 Oak Street",
    addressLine2: "",
    city: "Northampton",
    county: "Northamptonshire",
    postcode: "NN1 1AA",
    propertyType: "House",
    projectDescription: "Fix a leak",
    photoCount: 0,
    photos: [],
    hasMeasurements: false,
    measurements: [],
    tradeAnswers: [],
    tradespersonBusiness: "John's Plumbing",
    tradespersonPhone: "07700 900 456",
    tradespersonEmail: "",
    suggestedNextAction: "Review the enquiry",
    siteVisitSlot: status === "site_visit_booked" ? "Thursday 09:30" : null,
    siteVisitStartsAt:
      status === "site_visit_booked" ? "2026-07-10T08:30:00.000Z" : null,
    timeline: [],
  };
}

describe("customer job link", () => {
  it("builds the customer confirmation path and url", () => {
    expect(buildCustomerJobPath("enquiry-1")).toBe("/customer/job/enquiry-1");
    expect(buildCustomerJobUrl("enquiry-1", "https://quoteforge.test")).toBe(
      "https://quoteforge.test/customer/job/enquiry-1"
    );
  });

  it("shows the customer link only after a site visit is booked", () => {
    expect(shouldShowCustomerJobLink(sampleEnquiry("new"))).toBe(false);
    expect(shouldShowCustomerJobLink(sampleEnquiry("reviewing"))).toBe(false);
    expect(shouldShowCustomerJobLink(sampleEnquiry("site_visit_booked"))).toBe(
      true
    );
  });
});
