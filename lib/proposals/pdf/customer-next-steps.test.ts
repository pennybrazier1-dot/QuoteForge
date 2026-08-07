import { describe, expect, it } from "vitest";
import {
  buildCustomerNextStepsFromPrep,
  CUSTOMER_NEXT_STEP,
  deriveCustomerThingsToConfirm,
  mergeCustomerNextStepsIntoThingsToConfirm,
  resolveCustomerOptionalExtras,
  stripCustomerFacingLinePrices,
  stripReadinessFromOptionalExtras,
  withoutCustomerNextSteps,
} from "@/lib/proposals/pdf/customer-next-steps";
import { createEmptyPrepNotes } from "@/lib/proposals/quick-quote-preparation";

describe("customer next steps", () => {
  it("builds customer-friendly readiness items from empty prep", () => {
    expect(
      buildCustomerNextStepsFromPrep({
        notes: createEmptyPrepNotes(),
        plannedStartDateText: "",
        plannedStartDateExact: "",
        photoCount: 0,
        photosNotRequired: false,
      })
    ).toEqual(
      expect.arrayContaining([
        CUSTOMER_NEXT_STEP.measurements,
        CUSTOMER_NEXT_STEP.materials,
        CUSTOMER_NEXT_STEP.siteVisit,
        CUSTOMER_NEXT_STEP.startDate,
        CUSTOMER_NEXT_STEP.photos,
      ])
    );
  });

  it("does not clear photos just because additional notes are filled", () => {
    const steps = buildCustomerNextStepsFromPrep({
      notes: {
        ...createEmptyPrepNotes(),
        additionalNotes: "Lots of notes about the kitchen",
      },
      plannedStartDateText: "next week",
      plannedStartDateExact: "",
      durationValue: "2",
      estimatedPrice: "900",
      jobDescription: "Kitchen refresh",
      customerName: "Alex",
      emailAddress: "a@example.com",
      propertyAddress: "1 High Street",
      photoCount: 0,
      photosNotRequired: false,
    });

    expect(steps).toContain(CUSTOMER_NEXT_STEP.photos);
  });

  it("clears photos when marked not required", () => {
    const steps = buildCustomerNextStepsFromPrep({
      notes: {
        measurements: "2.1",
        materialsRequired: "Tiles",
        accessRequirements: "Gate",
        additionalNotes: "Chose grey",
        customerChoices: "Chose grey",
      },
      plannedStartDateText: "next week",
      plannedStartDateExact: "",
      durationValue: "2",
      estimatedPrice: "900",
      jobDescription: "Bathroom",
      customerName: "Alex",
      emailAddress: "a@example.com",
      propertyAddress: "1 High Street",
      photoCount: 0,
      photosNotRequired: true,
      siteVisitCompleted: true,
    });

    expect(steps).toEqual([]);
  });

  it("derives and rewrites next steps from stored phrases and legacy extras", () => {
    expect(
      deriveCustomerThingsToConfirm({
        thingsToConfirm: ["What we find when we visit", "Access height"],
        optionalExtrasText:
          "Still to confirm later: Materials to confirm; Start date to confirm.",
      })
    ).toEqual(
      expect.arrayContaining([
        CUSTOMER_NEXT_STEP.measurements,
        CUSTOMER_NEXT_STEP.siteVisit,
        CUSTOMER_NEXT_STEP.access,
        CUSTOMER_NEXT_STEP.materials,
        CUSTOMER_NEXT_STEP.startDate,
      ])
    );
  });

  it("keeps technical confirm items separate from known readiness phrases", () => {
    expect(
      withoutCustomerNextSteps([
        CUSTOMER_NEXT_STEP.measurements,
        "Confirm tile colour",
      ])
    ).toEqual(["Confirm tile colour"]);
  });

  it("strips readiness and prep-note blurbs from optional extras text", () => {
    const cleaned = stripReadinessFromOptionalExtras(
      [
        "Measurements / dimensions:\n2.1 x 1.8",
        "Still to confirm later: Measurements to confirm.",
        "Consider booking a site visit to confirm measurements.",
      ].join("\n\n")
    );

    expect(cleaned).toBe("");
  });

  it("keeps only true optional extras and drops internal pricing lines", () => {
    expect(
      resolveCustomerOptionalExtras([
        "Measurements / dimensions:\n2.1 x 1.8",
        "Additional costs",
        "Materials cost: £320",
        "£40",
        "Supply and fit a heated towel rail.",
      ])
    ).toEqual(["Supply and fit a heated towel rail."]);
  });

  it("strips line-item prices from materials", () => {
    expect(
      stripCustomerFacingLinePrices([
        "Grey tiles — £120.00",
        "Adhesive (£18)",
        "Grout",
      ])
    ).toEqual(["Grey tiles", "Adhesive", "Grout"]);
  });

  it("merges next steps ahead of technical confirms", () => {
    expect(
      mergeCustomerNextStepsIntoThingsToConfirm(
        ["Confirm tile colour"],
        [CUSTOMER_NEXT_STEP.startDate]
      )
    ).toEqual([CUSTOMER_NEXT_STEP.startDate, "Tile colour to be confirmed."]);
  });
});
