import { describe, expect, it } from "vitest";
import {
  buildCustomerNextStepsFromPrep,
  CUSTOMER_NEXT_STEP,
  deriveCustomerThingsToConfirm,
  mergeCustomerNextStepsIntoThingsToConfirm,
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

  it("derives next steps from stored phrases and legacy extras", () => {
    expect(
      deriveCustomerThingsToConfirm({
        thingsToConfirm: [CUSTOMER_NEXT_STEP.measurements, "Access height"],
        optionalExtrasText:
          "Still to confirm later: Materials to confirm; Start date to confirm.\n\nConsider booking a site visit to confirm measurements.",
      })
    ).toEqual(
      expect.arrayContaining([
        CUSTOMER_NEXT_STEP.measurements,
        CUSTOMER_NEXT_STEP.materials,
        CUSTOMER_NEXT_STEP.startDate,
        CUSTOMER_NEXT_STEP.siteVisit,
      ])
    );
  });

  it("keeps technical confirm items separate from next steps", () => {
    expect(
      withoutCustomerNextSteps([
        CUSTOMER_NEXT_STEP.measurements,
        "Confirm tile colour",
      ])
    ).toEqual(["Confirm tile colour"]);
  });

  it("strips readiness blurbs from optional extras", () => {
    const cleaned = stripReadinessFromOptionalExtras(
      [
        "Measurements / dimensions:\n2.1 x 1.8",
        "Still to confirm later: Measurements to confirm.",
        "Consider booking a site visit to confirm measurements.",
      ].join("\n\n")
    );

    expect(cleaned).toContain("Measurements / dimensions:");
    expect(cleaned).not.toContain("Still to confirm later");
    expect(cleaned).not.toContain("site visit");
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
    ).toEqual([CUSTOMER_NEXT_STEP.startDate, "Confirm tile colour"]);
  });
});
