import { describe, expect, it } from "vitest";
import {
  CUSTOMER_FACING_BUSINESS_NAME_FALLBACK,
  isNonCustomerFacingBusinessName,
  resolveCustomerFacingBusinessName,
} from "@/lib/proposals/pdf/customer-branding";

describe("customer-facing business branding", () => {
  it("keeps normal trader business names", () => {
    expect(resolveCustomerFacingBusinessName("Sneddom Plumbing Ltd")).toBe(
      "Sneddom Plumbing Ltd"
    );
    expect(isNonCustomerFacingBusinessName("Sneddom Plumbing Ltd")).toBe(false);
  });

  it("blocks admin and test workspace branding", () => {
    expect(resolveCustomerFacingBusinessName("Reanvil Admin Testing")).toBe(
      CUSTOMER_FACING_BUSINESS_NAME_FALLBACK
    );
    expect(resolveCustomerFacingBusinessName("Platform Admin")).toBe(
      CUSTOMER_FACING_BUSINESS_NAME_FALLBACK
    );
    expect(resolveCustomerFacingBusinessName("  ")).toBe(
      CUSTOMER_FACING_BUSINESS_NAME_FALLBACK
    );
  });
});
