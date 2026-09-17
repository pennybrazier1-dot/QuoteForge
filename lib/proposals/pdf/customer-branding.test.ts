import { describe, expect, it } from "vitest";
import {
  CUSTOMER_FACING_BUSINESS_NAME_FALLBACK,
  WORKSPACE_HAS_PERSISTED_LOGO,
  isNonCustomerFacingBusinessName,
  loadWorkspaceEmailLogoUrl,
  resolveCustomerFacingBusinessLogoUrl,
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

  it("only accepts a real http logo URL", () => {
    expect(
      resolveCustomerFacingBusinessLogoUrl("https://cdn.example.com/logo.png")
    ).toBe("https://cdn.example.com/logo.png");
    expect(resolveCustomerFacingBusinessLogoUrl("")).toBeNull();
    expect(resolveCustomerFacingBusinessLogoUrl("javascript:alert(1)")).toBeNull();
  });

  it("does not invent a workspace logo because none is persisted yet", () => {
    expect(WORKSPACE_HAS_PERSISTED_LOGO).toBe(false);
    expect(loadWorkspaceEmailLogoUrl({})).toBeNull();
    expect(
      loadWorkspaceEmailLogoUrl({
        logo_url: "https://cdn.example.com/penny-logo.png",
      })
    ).toBe("https://cdn.example.com/penny-logo.png");
  });
});
