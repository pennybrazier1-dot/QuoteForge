import { describe, expect, it } from "vitest";
import {
  buildSiteVisitModePath,
  shouldShowSiteVisitModeLink,
} from "@/lib/enquiries/site-visit-mode-link";
import type { StoredEnquiry } from "@/lib/enquiries/types";

function sampleEnquiry(status: StoredEnquiry["status"]): StoredEnquiry {
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
    siteVisitSlot:
      status === "site_visit_booked" || status === "site_visit_completed"
        ? "Thursday 09:30"
        : null,
    siteVisitStartsAt:
      status === "site_visit_booked" || status === "site_visit_completed"
        ? "2026-07-10T08:30:00.000Z"
        : null,
    timeline: [],
  };
}

describe("site visit mode link", () => {
  it("builds the site visit mode path", () => {
    expect(buildSiteVisitModePath("enquiry-1")).toBe("/site-visit/enquiry-1");
  });

  it("shows the site visit mode link after booking or completion", () => {
    expect(shouldShowSiteVisitModeLink(sampleEnquiry("reviewing"))).toBe(false);
    expect(shouldShowSiteVisitModeLink(sampleEnquiry("site_visit_booked"))).toBe(
      true
    );
    expect(
      shouldShowSiteVisitModeLink(sampleEnquiry("site_visit_completed"))
    ).toBe(true);
  });
});
