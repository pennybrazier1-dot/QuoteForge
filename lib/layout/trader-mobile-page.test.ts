import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOBILE_FORM_LAYOUT } from "@/lib/layout/mobile-form-layout";
import {
  pageSourceHasDuplicateMobilePadding,
  pageSourceUsesTraderPageClass,
  TRADER_MOBILE_PAGE_CLASS,
  TRADER_MOBILE_PAGE_LAYOUT,
  TRADER_MOBILE_PAGE_SOURCES,
  TRADER_MOBILE_WIDTH_EXCEPTIONS,
  TRADER_PORTAL_LAYOUT_SOURCES,
  traderPageUsesCanonicalMobileWidth,
} from "@/lib/layout/trader-mobile-page";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("trader mobile page width", () => {
  it("uses one canonical mobile page padding token globally", () => {
    expect(traderPageUsesCanonicalMobileWidth()).toBe(true);
    expect(TRADER_MOBILE_PAGE_LAYOUT.pagePaddingToken).toBe(
      "var(--page-padding-mobile)"
    );
    expect(TRADER_MOBILE_PAGE_LAYOUT.pagePaddingToken).toBe(
      MOBILE_FORM_LAYOUT.pagePaddingToken
    );
    const shell = readRepo("app/shell.css");
    expect(shell).toContain("padding: 1rem var(--page-padding-mobile)");
    expect(shell).not.toContain("padding-inline: var(--page-padding-tablet)");
    expect(shell).toContain("padding: 2.5rem var(--page-padding-desktop) 3.5rem");
  });

  it("does not give normal mobile cards a second page gutter", () => {
    expect(TRADER_MOBILE_PAGE_LAYOUT.extraInlinePadding).toBe("0");
    const css = readRepo("app/globals.css");
    expect(css).toContain(".qf-app-main > .qf-trader-page");
    expect(css).toMatch(
      /\.qf-app-main > \.qf-trader-page[\s\S]*padding-inline:\s*0/
    );
    expect(css).toMatch(
      /\.qf-customer-page,[\s\S]*?padding-inline:\s*0/
    );
    expect(css).toContain("padding: 1.5rem 0 2.5rem");
  });

  it("keeps Home cards on the canonical width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.home);
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding(source)).toBe(false);
  });

  it("keeps customer rows on the canonical width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.customers);
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding(source)).toBe(false);
    expect(source).toContain("lg:max-w-6xl");
  });

  it("keeps customer detail sections on the canonical width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.customerDetail);
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding(source)).toBe(false);
    expect(source).toContain("lg:max-w-3xl");
  });

  it("keeps New Visit on the canonical width", () => {
    const page = readRepo(TRADER_MOBILE_PAGE_SOURCES.newVisit);
    const form = readRepo(TRADER_MOBILE_PAGE_SOURCES.createVisit);
    expect(pageSourceUsesTraderPageClass(page)).toBe(true);
    expect(pageSourceUsesTraderPageClass(form)).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding(page)).toBe(false);
  });

  it("keeps Visit detail on the canonical width", () => {
    const page = readRepo(TRADER_MOBILE_PAGE_SOURCES.visitDetail);
    const view = readRepo(TRADER_MOBILE_PAGE_SOURCES.visitDetailView);
    expect(pageSourceUsesTraderPageClass(page)).toBe(true);
    expect(pageSourceUsesTraderPageClass(view)).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding(page)).toBe(false);
  });

  it("keeps New Quote on the canonical width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.newQuote);
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
    expect(source).toContain("qf-mobile-form-page");
  });

  it("keeps Quick Quote on the canonical width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.quickQuote);
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
    expect(source).toContain("qf-mobile-form-page");
  });

  it("keeps proposal detail on the canonical width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.proposalDetail);
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
    expect(source).toContain("qf-proposal-page");
    expect(pageSourceHasDuplicateMobilePadding(source)).toBe(false);
  });

  it("keeps Needs Attention on the same proposal-detail width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.proposalDetail);
    expect(source).toContain("qf-attention-desktop-block");
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
  });

  it("keeps Waiting for Customer on the same proposal-detail width", () => {
    const source = readRepo(TRADER_MOBILE_PAGE_SOURCES.proposalDetail);
    expect(source).toContain("qf-waiting-status");
    expect(pageSourceUsesTraderPageClass(source)).toBe(true);
  });

  it("keeps calendar and scheduling cards on the canonical width", () => {
    const calendar = readRepo(TRADER_MOBILE_PAGE_SOURCES.calendar);
    const schedule = readRepo(TRADER_MOBILE_PAGE_SOURCES.schedule);
    expect(pageSourceUsesTraderPageClass(calendar)).toBe(true);
    expect(pageSourceUsesTraderPageClass(schedule)).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding(calendar)).toBe(false);
    expect(pageSourceHasDuplicateMobilePadding(schedule)).toBe(false);
  });

  it("keeps Settings and More cards on the canonical width", () => {
    const settings = readRepo(TRADER_MOBILE_PAGE_SOURCES.settings);
    const more = readRepo(TRADER_MOBILE_PAGE_SOURCES.more);
    expect(pageSourceUsesTraderPageClass(settings)).toBe(true);
    expect(pageSourceUsesTraderPageClass(more)).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding(settings)).toBe(false);
    expect(pageSourceHasDuplicateMobilePadding(more)).toBe(false);
  });

  it("keeps inputs inside card bounds", () => {
    const css = readRepo("app/globals.css");
    expect(css).toContain(".qf-trader-page .form-input");
    expect(css).toContain(".qf-trader-page .form-textarea");
    expect(css).toMatch(
      /\.qf-trader-page \.form-input,[\s\S]*max-width:\s*100%/
    );
    expect(TRADER_MOBILE_PAGE_LAYOUT.boxSizing).toBe("border-box");
  });

  it("clips horizontal overflow on trader mobile pages", () => {
    const css = readRepo("app/globals.css");
    expect(css).toMatch(
      /\.qf-trader-page,[\s\S]*overflow-x:\s*hidden/
    );
    expect(TRADER_MOBILE_PAGE_LAYOUT.minWidth).toBe("0");
  });

  it("leaves desktop max-width behaviour intact", () => {
    expect(TRADER_MOBILE_PAGE_LAYOUT.desktopKeepsMaxWidth).toBe(true);
    const settings = readRepo(TRADER_MOBILE_PAGE_SOURCES.settings);
    const customers = readRepo(TRADER_MOBILE_PAGE_SOURCES.customers);
    const homeCss = readRepo("app/mobile-home.css");
    const calendarCss = readRepo("app/globals.css");
    expect(settings).toContain("lg:max-w-3xl");
    expect(customers).toContain("lg:max-w-6xl");
    expect(homeCss).toContain("max-width: 56rem");
    expect(calendarCss).toContain(".qf-calendar-page");
    expect(calendarCss).toMatch(
      /@media \(min-width: 1024px\) \{[\s\S]*\.qf-calendar-page \{[\s\S]*max-width: 56rem/
    );
  });

  it("does not apply the trader width system to the customer portal", () => {
    expect(TRADER_MOBILE_PAGE_LAYOUT.appliesToCustomerPortal).toBe(false);
    for (const file of TRADER_PORTAL_LAYOUT_SOURCES) {
      const source = readRepo(file);
      expect(source).not.toContain(TRADER_MOBILE_PAGE_CLASS);
      expect(source).not.toContain("qf-app-main");
    }
    expect(readRepo("app/customer/layout.tsx")).toContain("cj-root");
    expect(readRepo("app/p/[token]/page.tsx")).toContain("cj-root--portal");
  });

  it("audits the remaining trader workspace roots", () => {
    const extra = [
      TRADER_MOBILE_PAGE_SOURCES.visits,
      TRADER_MOBILE_PAGE_SOURCES.proposalsList,
      TRADER_MOBILE_PAGE_SOURCES.newCustomer,
      TRADER_MOBILE_PAGE_SOURCES.editCustomer,
      TRADER_MOBILE_PAGE_SOURCES.enquiries,
      TRADER_MOBILE_PAGE_SOURCES.enquiryDetail,
      TRADER_MOBILE_PAGE_SOURCES.quotePrep,
    ];
    for (const file of extra) {
      const source = readRepo(file);
      expect(pageSourceUsesTraderPageClass(source)).toBe(true);
      expect(pageSourceHasDuplicateMobilePadding(source)).toBe(false);
    }
  });

  it("treats sheets and chips as intentional exceptions", () => {
    expect(TRADER_MOBILE_WIDTH_EXCEPTIONS).toContain("new menu sheet");
    expect(TRADER_MOBILE_WIDTH_EXCEPTIONS).toContain("modal/dialog inset");
    expect(TRADER_MOBILE_WIDTH_EXCEPTIONS).toContain("badges/chips");
    expect(pageSourceHasDuplicateMobilePadding("lg:px-6")).toBe(false);
    expect(pageSourceHasDuplicateMobilePadding("px-6 py-10")).toBe(true);
    expect(pageSourceHasDuplicateMobilePadding("px-4 sm:px-6")).toBe(true);
  });
});
