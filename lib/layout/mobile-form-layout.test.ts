import { describe, expect, it } from "vitest";
import {
  MOBILE_FORM_LAYOUT,
  mobileFormUsesHomeWidth,
} from "@/lib/layout/mobile-form-layout";
import { MOBILE_NEW_MENU_VISUAL } from "@/lib/layout/mobile-new-menu";

describe("mobile form layout", () => {
  it("reuses Home page padding and does not add a narrower column", () => {
    expect(mobileFormUsesHomeWidth()).toBe(true);
    expect(MOBILE_FORM_LAYOUT.pagePaddingToken).toBe(
      "var(--page-padding-mobile)"
    );
    expect(MOBILE_FORM_LAYOUT.extraInlinePadding).toBe("0");
    expect(MOBILE_FORM_LAYOUT.maxWidth).toBe("100%");
  });

  it("matches Home card padding, radius, and stack gap", () => {
    expect(MOBILE_FORM_LAYOUT.cardPadding).toBe("1rem");
    expect(MOBILE_FORM_LAYOUT.cardRadiusToken).toBe("var(--radius-card)");
    expect(MOBILE_FORM_LAYOUT.cardGap).toBe("0.75rem");
  });

  it("shares the New menu orange and radius tokens", () => {
    expect(MOBILE_FORM_LAYOUT.cardRadiusToken).toBe(
      MOBILE_NEW_MENU_VISUAL.radiusToken
    );
    expect(MOBILE_FORM_LAYOUT.pagePaddingToken).toBe(
      MOBILE_NEW_MENU_VISUAL.pagePaddingToken
    );
    expect(MOBILE_NEW_MENU_VISUAL.sheetBorderToken).toBe(
      "var(--card-border-color)"
    );
  });
});
