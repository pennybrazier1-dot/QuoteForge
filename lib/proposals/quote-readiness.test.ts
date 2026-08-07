import { describe, expect, it } from "vitest";
import {
  buildCustomerThingsToConfirm,
  getIncompleteQuoteReadinessItems,
} from "@/lib/proposals/quote-readiness";
import { createEmptyPrepNotes } from "@/lib/proposals/quick-quote-preparation";

function baseInput(
  overrides: Partial<Parameters<typeof getIncompleteQuoteReadinessItems>[0]> = {}
) {
  return {
    customerName: "Mrs Whitfield",
    emailAddress: "sarah@example.com",
    phoneNumber: "",
    propertyAddress: "14 Riverside Close",
    notes: createEmptyPrepNotes(),
    jobDescription: "Bathroom refit",
    photoCount: 0,
    photosNotRequired: false,
    siteVisitCompleted: false,
    durationValue: "2",
    plannedStartDateText: "next week",
    plannedStartDateExact: "",
    estimatedPrice: "940",
    paymentTermsSupported: false,
    ...overrides,
  };
}

describe("quote readiness checklist", () => {
  it("with AI notes-first, skips optional-field nags when job notes exist", () => {
    const incomplete = getIncompleteQuoteReadinessItems(
      baseInput({
        aiNotesFirst: true,
        jobDescription:
          "Full bathroom refit, grey tiles, approx 2.1 x 1.8, park on road, week commencing 18th",
        notes: createEmptyPrepNotes(),
        photoCount: 0,
        photosNotRequired: true,
        estimatedPrice: "940",
      })
    );

    expect(incomplete.map((item) => item.id)).toEqual([]);
  });

  it("lists soft incomplete items for empty prep", () => {
    const incomplete = getIncompleteQuoteReadinessItems(
      baseInput({
        notes: createEmptyPrepNotes(),
        photoCount: 0,
        photosNotRequired: false,
        durationValue: "",
        plannedStartDateText: "",
        estimatedPrice: "",
      })
    );

    expect(incomplete.map((item) => item.traderLabel)).toEqual(
      expect.arrayContaining([
        "Measurements/dimensions to confirm",
        "Photos/site conditions to confirm",
        "Site visit to confirm",
        "Access requirements to confirm",
        "Materials/specifications to confirm",
        "Customer choices to confirm",
        "Duration to confirm",
        "Start date to confirm",
        "Pricing to complete",
      ])
    );
  });

  it("completes photos only with an upload or explicit not-required mark", () => {
    const withNotesOnly = getIncompleteQuoteReadinessItems(
      baseInput({
        notes: {
          ...createEmptyPrepNotes(),
          additionalNotes: "Kitchen looks tired",
        },
      })
    );
    expect(
      withNotesOnly.some((item) => item.id === "photos")
    ).toBe(true);

    const withPhoto = getIncompleteQuoteReadinessItems(
      baseInput({ photoCount: 1 })
    );
    expect(withPhoto.some((item) => item.id === "photos")).toBe(false);

    const notRequired = getIncompleteQuoteReadinessItems(
      baseInput({ photosNotRequired: true })
    );
    expect(notRequired.some((item) => item.id === "photos")).toBe(false);
  });

  it("hides site visit reminder once measurements are entered", () => {
    const incomplete = getIncompleteQuoteReadinessItems(
      baseInput({
        notes: {
          ...createEmptyPrepNotes(),
          measurements: "2.1 x 1.8",
        },
      })
    );

    expect(incomplete.some((item) => item.id === "site_visit")).toBe(false);
  });

  it("builds customer PDF labels without trader-only items", () => {
    const incomplete = getIncompleteQuoteReadinessItems(
      baseInput({
        customerName: "",
        emailAddress: "",
        estimatedPrice: "",
      })
    );

    const customer = buildCustomerThingsToConfirm(incomplete);
    expect(customer).toContain("Final measurements to be confirmed.");
    expect(customer).toContain("Site photos and conditions to be confirmed.");
    expect(customer.join(" ")).not.toMatch(/Pricing to complete/i);
    expect(customer.join(" ")).not.toMatch(/Customer contact/i);
  });

  it("returns no reminders when the checklist is complete", () => {
    const incomplete = getIncompleteQuoteReadinessItems(
      baseInput({
        notes: {
          measurements: "2.1 x 1.8",
          materialsRequired: "Grey tiles",
          accessRequirements: "Side gate",
          additionalNotes: "Customer chose satin finish",
        },
        photoCount: 0,
        photosNotRequired: true,
        siteVisitCompleted: true,
      })
    );

    expect(incomplete).toEqual([]);
    expect(buildCustomerThingsToConfirm(incomplete)).toEqual([]);
  });
});
