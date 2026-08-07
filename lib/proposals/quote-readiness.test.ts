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
    phoneNumber: "07700 900123",
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
  it("flags phone, email, and job address separately when missing", () => {
    const incomplete = getIncompleteQuoteReadinessItems(
      baseInput({
        phoneNumber: "",
        emailAddress: "",
        propertyAddress: "",
      })
    );

    expect(incomplete.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "customer_phone",
        "customer_email",
        "full_address",
      ])
    );
    expect(incomplete.some((item) => item.id === "customer_name")).toBe(false);
  });

  it("still flags phone when email is present", () => {
    const incomplete = getIncompleteQuoteReadinessItems(
      baseInput({
        phoneNumber: "",
        emailAddress: "sarah@example.com",
      })
    );

    expect(incomplete.some((item) => item.id === "customer_phone")).toBe(true);
    expect(incomplete.some((item) => item.id === "customer_email")).toBe(false);
  });

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
    expect(withNotesOnly.some((item) => item.id === "photos")).toBe(true);

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
        phoneNumber: "",
        estimatedPrice: "",
      })
    );

    const customer = buildCustomerThingsToConfirm(incomplete);
    expect(customer).toContain("Measurements to be confirmed.");
    expect(customer).toContain("Site photos and conditions to be confirmed.");
    expect(customer.join(" ")).not.toMatch(/Pricing to complete/i);
    expect(customer.join(" ")).not.toMatch(/Customer phone/i);
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

  it("builds a soft Things to confirm summary with folded related items", () => {
    const summary = buildThingsToConfirmSummary(
      baseInput({
        aiNotesFirst: true,
        customerName: "",
        emailAddress: "",
        phoneNumber: "",
        propertyAddress: "",
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

    const customerLabels = summary.groups
      .find((group) => group.id === "customer")
      ?.items.map((item) => item.label);
    expect(customerLabels).toEqual(
      expect.arrayContaining([
        "Customer name",
        "Customer phone number",
        "Customer email",
        "Job address",
      ])
    );

    const measurements = summary.groups
      .find((group) => group.id === "job")
      ?.items.find((item) => item.id === "measurements");
    expect(measurements?.label).toBe("Measurements to be confirmed");
    expect(measurements?.children).toContain(
      "Site visit recommended to confirm measurements"
    );

    const dates = summary.groups
      .find((group) => group.id === "planning")
      ?.items.find((item) => item.id === "dates");
    expect(dates?.label).toBe("Dates to be confirmed");
    expect(dates?.children).toEqual(
      expect.arrayContaining([
        "Duration to be confirmed",
        "Start date to be confirmed",
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
