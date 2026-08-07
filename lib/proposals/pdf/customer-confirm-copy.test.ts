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
      toCustomerFacingConfirmItem("Customer phone number to confirm")
    ).toBeNull();
    expect(toCustomerFacingConfirmItem("Pricing to complete")).toBeNull();
  });

  it("dedupes related measurement and materials bullets", () => {
    expect(
      toCustomerFacingThingsToConfirm([
        "Final measurements to be confirmed",
        "Exact measurements of bathroom space to be confirmed",
        "What we find when we visit",
        "Materials to confirm",
        "Customer choices to confirm",
        "Confirm tile colour",
      ])
    ).toEqual([
      CUSTOMER_CONFIRM_COPY.measurements,
      CUSTOMER_CONFIRM_COPY.siteVisit,
      CUSTOMER_CONFIRM_COPY.materials,
      "Tile colour to be confirmed.",
    ]);
  });
});
