import { describe, expect, it } from "vitest";
import {
  buildCustomerNextStepsFromPrep,
  buildCustomerNextStepsFromWarnings,
  CUSTOMER_NEXT_STEP,
  deriveCustomerNextSteps,
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
      })
    ).toEqual([
      CUSTOMER_NEXT_STEP.measurements,
      CUSTOMER_NEXT_STEP.materials,
      CUSTOMER_NEXT_STEP.siteVisit,
      CUSTOMER_NEXT_STEP.startDate,
    ]);
  });

  it("omits confirmed items", () => {
    expect(
      buildCustomerNextStepsFromWarnings({
        missingWarnings: [],
        suggestSiteVisit: false,
      })
    ).toEqual([]);
  });

  it("derives next steps from stored phrases and legacy extras", () => {
    expect(
      deriveCustomerNextSteps({
        thingsToConfirm: [CUSTOMER_NEXT_STEP.measurements, "Access height"],
        optionalExtrasText:
          "Still to confirm later: Materials to confirm; Start date to confirm.\n\nConsider booking a site visit to confirm measurements.",
      })
    ).toEqual([
      CUSTOMER_NEXT_STEP.measurements,
      CUSTOMER_NEXT_STEP.materials,
      CUSTOMER_NEXT_STEP.startDate,
      CUSTOMER_NEXT_STEP.siteVisit,
    ]);
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
