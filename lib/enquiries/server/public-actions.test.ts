import { describe, expect, it } from "vitest";

/**
 * Lightweight contract tests for public intake helpers.
 * Full RPC/RLS checks require a live Supabase project with the Phase 2 migration applied.
 */
describe("public enquiry intake contracts", () => {
  it("rejects short or empty slugs before calling the server", async () => {
    const { submitPublicEnquiryAction } = await import(
      "@/lib/enquiries/server/public-actions"
    );

    const result = await submitPublicEnquiryAction({
      slug: "short",
      formData: {
        trade: "plumbing",
        selectedService: "Plumbing",
        name: "Sam",
        mobile: "07700900123",
        email: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postcode: "",
        propertyType: null,
        projectDescription: "Leak",
        photos: [],
        knowsMeasurements: null,
        measurements: [],
        tradeAnswers: {},
      },
      serviceRequested: "Plumbing",
      trade: "plumbing",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not valid/i);
    }
  });

  it("requires a name and at least one contact method", async () => {
    const { submitPublicEnquiryAction } = await import(
      "@/lib/enquiries/server/public-actions"
    );

    const missingName = await submitPublicEnquiryAction({
      slug: "qfvalidslug12345",
      formData: {
        trade: "plumbing",
        selectedService: "Plumbing",
        name: "   ",
        mobile: "07700900123",
        email: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postcode: "",
        propertyType: null,
        projectDescription: "Leak",
        photos: [],
        knowsMeasurements: null,
        measurements: [],
        tradeAnswers: {},
      },
      serviceRequested: "Plumbing",
      trade: "plumbing",
    });

    expect(missingName.ok).toBe(false);

    const missingContact = await submitPublicEnquiryAction({
      slug: "qfvalidslug12345",
      formData: {
        trade: "plumbing",
        selectedService: "Plumbing",
        name: "Sam",
        mobile: "",
        email: "  ",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postcode: "",
        propertyType: null,
        projectDescription: "Leak",
        photos: [],
        knowsMeasurements: null,
        measurements: [],
        tradeAnswers: {},
      },
      serviceRequested: "Plumbing",
      trade: "plumbing",
    });

    expect(missingContact.ok).toBe(false);
  });
});
