import { describe, expect, it } from "vitest";
import {
  CUSTOMER_CONFIRM_COPY,
  toCustomerFacingConfirmItem,
  toCustomerFacingThingsToConfirm,
} from "@/lib/proposals/pdf/customer-confirm-copy";

describe("customer confirm copy", () => {
  it("rewrites internal site-visit wording into professional customer language", () => {
    expect(toCustomerFacingConfirmItem("What we find when we visit")).toBe(
      CUSTOMER_CONFIRM_COPY.siteVisit
    );
    expect(toCustomerFacingConfirmItem("Site visit required")).toBe(
      CUSTOMER_CONFIRM_COPY.siteVisit
    );
  });

  it("rewrites Confirm-prefix AI bullets", () => {
    expect(toCustomerFacingConfirmItem("Confirm tile colour")).toBe(
      "Tile colour to be confirmed."
    );
    expect(toCustomerFacingConfirmItem("Confirm planned start date")).toBe(
      CUSTOMER_CONFIRM_COPY.startDate
    );
  });

  it("drops trader-only checklist items", () => {
    expect(
      toCustomerFacingConfirmItem("Customer contact details to confirm")
    ).toBeNull();
    expect(toCustomerFacingConfirmItem("Pricing to complete")).toBeNull();
  });

  it("dedupes rewritten customer bullets", () => {
    expect(
      toCustomerFacingThingsToConfirm([
        "What we find when we visit",
        "Site visit required",
        "Confirm tile colour",
      ])
    ).toEqual([
      CUSTOMER_CONFIRM_COPY.siteVisit,
      "Tile colour to be confirmed.",
    ]);
  });
});
