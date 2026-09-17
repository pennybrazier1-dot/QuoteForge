import { describe, expect, it } from "vitest";
import { DESKTOP_SIDEBAR_ITEMS } from "@/lib/layout/app-nav";
import { classifyHomeVisit } from "@/lib/home/home-lifecycle";
import {
  desktopNewNavigation,
  getMobileNewMenuOption,
  initialVisitCreateSideEffects,
  MOBILE_NEW_MENU_OPTIONS,
  MOBILE_NEW_MENU_TITLE,
  MOBILE_NEW_MENU_VISUAL,
  MOBILE_NEW_QUOTE_HREF,
  MOBILE_NEW_VISIT_HREF,
  mobilePlusOpensNewMenu,
} from "@/lib/layout/mobile-new-menu";
import {
  MOBILE_FORM_LAYOUT,
  mobileFormUsesHomeWidth,
} from "@/lib/layout/mobile-form-layout";
import type { VisitRecord } from "@/lib/visits/types";

function savedVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    id: "visit-new",
    workspace_id: "ws-1",
    customer_id: "cust-1",
    enquiry_id: null,
    customer_name: "Alex Customer",
    contact_phone: "07700 900123",
    contact_email: "alex@example.com",
    address_line_1: "12 High Street",
    address_line_2: "",
    town: "Leeds",
    county: "",
    postcode: "LS1 1AA",
    enquiry_summary: "Kitchen assessment",
    visit_type: "initial_assessment",
    visit_date: "2026-08-12",
    visit_time: "09:30",
    duration_minutes: 60,
    status: "scheduled",
    notes: "",
    linked_proposal_id: null,
    created_at: "2026-08-12T09:05:00.000Z",
    updated_at: "2026-08-12T09:05:00.000Z",
    ...overrides,
  };
}

describe("mobile New (+) menu", () => {
  it("opens a New menu from the mobile + button", () => {
    expect(mobilePlusOpensNewMenu()).toBe(true);
    expect(MOBILE_NEW_MENU_TITLE).toBe("New");
    expect(MOBILE_NEW_MENU_OPTIONS).toHaveLength(2);
  });

  it("shows Initial Visit", () => {
    const visit = getMobileNewMenuOption("initial_visit");
    expect(visit.label).toBe("Initial Visit");
    expect(visit.subtitle).toMatch(/inspect or measure/i);
  });

  it("shows Quote", () => {
    const quote = getMobileNewMenuOption("quote");
    expect(quote.label).toBe("Quote");
    expect(quote.subtitle).toMatch(/enough information/i);
  });

  it("sends Initial Visit to the existing visit creation flow", () => {
    expect(getMobileNewMenuOption("initial_visit").href).toBe(
      MOBILE_NEW_VISIT_HREF
    );
    expect(MOBILE_NEW_VISIT_HREF).toBe("/visits/new");
  });

  it("does not create a quote or job from Initial Visit", () => {
    const visit = getMobileNewMenuOption("initial_visit");
    const effects = initialVisitCreateSideEffects();
    expect(visit.createsQuote).toBe(false);
    expect(visit.createsJob).toBe(false);
    expect(effects.createsQuote).toBe(false);
    expect(effects.createsJob).toBe(false);
    expect(effects.createsProposal).toBe(false);
    expect(effects.createsVisit).toBe(true);
  });

  it("sends Quote to the existing Quick Quote flow", () => {
    expect(getMobileNewMenuOption("quote").href).toBe(MOBILE_NEW_QUOTE_HREF);
    expect(MOBILE_NEW_QUOTE_HREF).toBe("/proposals/new");
    expect(getMobileNewMenuOption("quote").createsQuote).toBe(true);
  });

  it("places a saved initial visit in the correct homepage bucket", () => {
    const now = new Date("2026-08-12T09:00:00.000Z");
    expect(classifyHomeVisit(savedVisit({ visit_date: "2026-08-12" }), now)).toBe(
      "today_visit"
    );
    expect(classifyHomeVisit(savedVisit({ visit_date: "2026-08-20" }), now)).toBe(
      "upcoming_visit"
    );
    expect(initialVisitCreateSideEffects().homepageBuckets).toEqual([
      "today_visit",
      "upcoming_visit",
    ]);
  });

  it("uses the same orange border tokens as Home and proposal cards", () => {
    expect(MOBILE_NEW_MENU_VISUAL.sheetBorderToken).toBe(
      "var(--card-border-color)"
    );
    expect(MOBILE_NEW_MENU_VISUAL.optionBorderToken).toBe(
      "var(--card-border-color)"
    );
    expect(MOBILE_NEW_MENU_VISUAL.accentToken).toBe("var(--accent)");
    expect(MOBILE_NEW_MENU_VISUAL.radiusToken).toBe("var(--radius-card)");
    expect(MOBILE_NEW_MENU_VISUAL.pagePaddingToken).toBe(
      "var(--page-padding-mobile)"
    );
  });

  it("keeps Initial Visit and Quote forms on the Home mobile width", () => {
    expect(mobileFormUsesHomeWidth()).toBe(true);
    expect(MOBILE_FORM_LAYOUT.extraInlinePadding).toBe("0");
    expect(MOBILE_FORM_LAYOUT.maxWidth).toBe("100%");
    expect(MOBILE_FORM_LAYOUT.cardPadding).toBe("1rem");
    expect(MOBILE_FORM_LAYOUT.cardGap).toBe("0.75rem");
    expect(MOBILE_FORM_LAYOUT.pagePaddingToken).toBe(
      "var(--page-padding-mobile)"
    );
  });

  it("keeps desktop Visits and New Quote navigation", () => {
    const desktop = desktopNewNavigation();
    expect(desktop.visitsHref).toBe("/visits");
    expect(desktop.newQuoteHref).toBe("/proposals/new");
    expect(desktop.newQuoteLabel).toBe("New Quote");
    expect(DESKTOP_SIDEBAR_ITEMS.map((item) => item.href)).toEqual(
      expect.arrayContaining(["/visits", "/proposals/new", "/dashboard"])
    );
  });
});
