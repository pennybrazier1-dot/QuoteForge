import { describe, expect, it } from "vitest";
import {
  buildCustomerJobViewModel,
  CUSTOMER_JOB_PREPARATION_NOTE,
} from "@/lib/customer/customer-job-data";
import type { StoredEnquiry } from "@/lib/enquiries/types";

function bookedEnquiry(): StoredEnquiry {
  return {
    id: "enquiry-1",
    status: "site_visit_booked",
    receivedAt: "2026-07-09T12:00:00.000Z",
    customerName: "Sarah Thompson",
    customerMobile: "07700 900123",
    customerEmail: "sarah@example.com",
    serviceRequested: "Plumbing",
    addressLine1: "12 Oak Avenue",
    addressLine2: "",
    city: "Northampton",
    county: "Northamptonshire",
    postcode: "NN1 1AA",
    propertyType: "House",
    projectDescription: "Fix a leaking tap",
    photoCount: 0,
    photos: [],
    hasMeasurements: false,
    measurements: [],
    tradeAnswers: [],
    tradespersonBusiness: "Smith Plumbing",
    tradespersonPhone: "07700 900 456",
    tradespersonEmail: "",
    suggestedNextAction: "Confirm the visit",
    siteVisitSlot: "Thursday 09:30",
    siteVisitStartsAt: "2026-07-10T08:30:00.000Z",
    timeline: [],
  };
}

describe("customer job data", () => {
  it("builds the customer confirmation view model", () => {
    const job = buildCustomerJobViewModel(bookedEnquiry());

    expect(job.businessName).toBe("Smith Plumbing");
    expect(job.address).toContain("12 Oak Avenue");
    expect(job.visitPurpose).toBe("Plumbing");
    expect(job.projectDescription).toBe("Fix a leaking tap");
    expect(job.preparationNote).toBe(CUSTOMER_JOB_PREPARATION_NOTE);
    expect(job.statusSteps.map((step) => step.label)).toEqual([
      "Enquiry received",
      "Site visit booked",
      "Quote to follow",
    ]);
    expect(job.statusSteps[1]?.state).toBe("current");
  });
});
