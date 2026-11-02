import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOBILE_BOTTOM_ACTIONS_CLASS,
  MOBILE_FORM_LAYOUT,
  mobileFormUsesHomeWidth,
} from "@/lib/layout/mobile-form-layout";
import { MOBILE_NEW_MENU_VISUAL } from "@/lib/layout/mobile-new-menu";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

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

  it("keeps shared bottom CTAs above the New (+) overhang on Visit, Quick Quote, and Invoice", () => {
    expect(MOBILE_BOTTOM_ACTIONS_CLASS).toBe("qf-mobile-bottom-actions");

    const css = readRepo("app/globals.css");
    const sharedIdx = css.indexOf(".qf-mobile-bottom-actions");
    expect(sharedIdx).toBeGreaterThan(-1);
    const mobileBlock = css.slice(sharedIdx - 80, sharedIdx + 900);
    expect(mobileBlock).toContain("@media (max-width: 1023px)");
    expect(mobileBlock).toContain("position: sticky");
    expect(mobileBlock).toContain("--qf-bottom-nav-measured-height");
    expect(mobileBlock).toContain("z-index: 90");

    const visit = readRepo("components/visits/create-visit-form.tsx");
    expect(visit).toContain(MOBILE_BOTTOM_ACTIONS_CLASS);
    expect(visit).toContain('name="notifyCustomer"');
    expect(visit).not.toMatch(/name="notifyCustomer"[\s\S]{0,80}defaultChecked/);

    const quote = readRepo("components/proposals/new-proposal-form.tsx");
    expect(quote).toContain(MOBILE_BOTTOM_ACTIONS_CLASS);

    const invoice = readRepo("components/invoices/invoice-review-screen.tsx");
    expect(invoice).toContain(
      `qf-invoice-actions ${MOBILE_BOTTOM_ACTIONS_CLASS}`
    );

    const nav = readRepo("app/mobile-home.css");
    expect(nav).toContain("qf-bottom-nav-primary");
    expect(nav).toContain("pointer-events: auto");
  });
});
