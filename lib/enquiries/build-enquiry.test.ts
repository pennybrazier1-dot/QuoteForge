import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER_TRADESPERSON } from "@/lib/customer-journey/constants";
import { createInitialState } from "@/lib/customer-journey/journey-state";
import { buildEnquiryFromJourney } from "@/lib/enquiries/build-enquiry";

describe("buildEnquiryFromJourney", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("timeline-received")
        .mockReturnValueOnce("timeline-photos")
        .mockReturnValueOnce("enquiry-id"),
    });
  });

  it("maps journey form data into a stored enquiry", () => {
    const formData = {
      ...createInitialState(PLACEHOLDER_TRADESPERSON).formData,
      name: "Jane Smith",
      mobile: "07700 900123",
      email: "jane@example.com",
      addressLine1: "12 Oak Street",
      addressLine2: "Flat 1",
      city: "Northampton",
      county: "Northamptonshire",
      postcode: "NN1 1AA",
      propertyType: "house" as const,
      projectDescription: "Replace kitchen worktops",
      knowsMeasurements: "yes" as const,
      measurements: [
        {
          id: "length",
          label: "Length",
          value: "3.2",
          unit: "m",
        },
      ],
      tradeAnswers: {
        plumbing_type: "Leak or repair",
      },
      photos: [{ name: "kitchen.jpg" } as File],
    };

    const enquiry = buildEnquiryFromJourney(formData, PLACEHOLDER_TRADESPERSON, [
      {
        id: "photo-1",
        name: "kitchen.jpg",
        size: 1_024,
        type: "image/jpeg",
        imageUrl: null,
        storageKey: null,
        thumbnailUrl: null,
      },
    ]);

    expect(enquiry).toMatchObject({
      id: "enquiry-id",
      status: "new",
      customerName: "Jane Smith",
      customerMobile: "07700 900123",
      customerEmail: "jane@example.com",
      addressLine1: "12 Oak Street",
      addressLine2: "Flat 1",
      city: "Northampton",
      county: "Northamptonshire",
      postcode: "NN1 1AA",
      propertyType: "House",
      projectDescription: "Replace kitchen worktops",
      photoCount: 1,
      hasMeasurements: true,
      tradespersonBusiness: PLACEHOLDER_TRADESPERSON.businessName,
    });
    expect(enquiry.photos).toHaveLength(1);
    expect(enquiry.photos[0]).not.toHaveProperty("dataUrl");
    expect(enquiry.tradeAnswers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId: "plumbing_type",
          answer: "Leak or repair",
        }),
      ])
    );
    expect(enquiry.timeline).toHaveLength(2);
    expect(enquiry.timeline[0]).toMatchObject({
      id: "timeline-received",
      label: "Enquiry received from Jane Smith.",
    });
    expect(enquiry.timeline[1]).toMatchObject({
      id: "timeline-photos",
      label: "Photos and project details were added to the enquiry.",
    });
  });

  it("marks measurements as not included when customer skipped them", () => {
    const formData = {
      ...createInitialState(PLACEHOLDER_TRADESPERSON).formData,
      name: "Alex Jones",
      knowsMeasurements: "no" as const,
    };

    const enquiry = buildEnquiryFromJourney(formData, PLACEHOLDER_TRADESPERSON);

    expect(enquiry.hasMeasurements).toBe(false);
    expect(enquiry.measurements).toEqual([]);
  });
});
