import { describe, expect, it } from "vitest";
import {
  buildCustomerThingsToConfirm,
  buildThingsToConfirmSummary,
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
  it("with AI notes-first, still lists confirmation items when optional fields are empty", () => {
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

    expect(incomplete.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "measurements",
        "site_visit",
        "access",
        "materials",
        "customer_choices",
      ])
    );
    expect(incomplete.some((item) => item.id === "scope")).toBe(false);
    expect(incomplete.some((item) => item.id === "photos")).toBe(false);
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
        "Measurements to confirm",
        "Photos/site conditions to confirm",
        "Site inspection to confirm",
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
        aiNotesFirst: true,
        jobDescription:
          "Full bathroom refit including suite, tiling, and waterproofing",
        notes: {
          measurements: "2.1 x 1.8",
          materialsRequired: "Grey tiles",
          customerChoices: "Customer chose satin finish",
          accessRequirements: "Side gate",
          additionalNotes: "",
        },
        photoCount: 0,
        photosNotRequired: true,
        siteVisitCompleted: true,
      })
    );

    expect(incomplete).toEqual([]);
    expect(buildCustomerThingsToConfirm(incomplete)).toEqual([]);
  });

  it("builds a soft Things to confirm summary (not a duplicate checklist)", () => {
    const summary = buildThingsToConfirmSummary(
      baseInput({
        aiNotesFirst: true,
        customerName: "",
        emailAddress: "",
        notes: createEmptyPrepNotes(),
        photoCount: 0,
        photosNotRequired: true,
        durationValue: "",
        plannedStartDateText: "",
        estimatedPrice: "",
      })
    );

    expect(summary.ready).toBe(false);
    expect(summary.groups.map((group) => group.title)).toEqual([
      "Missing customer information",
      "Missing job information",
      "Missing planning information",
    ]);
    expect(
      summary.groups.flatMap((group) => group.items.map((item) => item.label))
    ).toEqual(
      expect.arrayContaining([
        "Name and phone or email",
        "Measurements",
        "Start date",
        "Customer quote total",
      ])
    );
  });

  it("shows Quote ready to send when summary is complete", () => {
    const summary = buildThingsToConfirmSummary(
      baseInput({
        aiNotesFirst: true,
        jobDescription:
          "Full bathroom refit including suite, tiling, and waterproofing",
        notes: {
          measurements: "2.1 x 1.8",
          materialsRequired: "Grey tiles",
          customerChoices: "Satin finish",
          accessRequirements: "Side gate",
          additionalNotes: "",
        },
        photoCount: 0,
        photosNotRequired: true,
        siteVisitCompleted: true,
      })
    );

    expect(summary.ready).toBe(true);
    expect(summary.groups).toEqual([]);
  });
});
