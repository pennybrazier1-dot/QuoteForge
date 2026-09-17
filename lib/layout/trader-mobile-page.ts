import { MOBILE_FORM_LAYOUT } from "@/lib/layout/mobile-form-layout";

/** Shared class for trader workspace page roots. Not used on the customer portal. */
export const TRADER_MOBILE_PAGE_CLASS = "qf-trader-page";

/**
 * One trader-app mobile content width.
 * The workspace shell applies --page-padding-mobile once.
 * Child pages must not add another px-4 / px-6 / max-w column on mobile.
 */
export const TRADER_MOBILE_PAGE_LAYOUT = {
  pagePaddingToken: MOBILE_FORM_LAYOUT.pagePaddingToken,
  extraInlinePadding: "0",
  width: "100%",
  maxWidth: "100%",
  minWidth: "0",
  boxSizing: "border-box",
  pageClassName: TRADER_MOBILE_PAGE_CLASS,
  cardStackClassName: "qf-mobile-card-stack",
  fullCardClassName: "qf-mobile-full-card",
  appliesToCustomerPortal: false,
  desktopKeepsMaxWidth: true,
} as const;

export const TRADER_MOBILE_WIDTH_EXCEPTIONS = [
  "modal/dialog inset",
  "new menu sheet",
  "badges/chips",
  "floating controls",
  "bottom nav",
  "desktop popovers",
] as const;

/** Workspace screens that must share the proposal-detail card edges. */
export const TRADER_MOBILE_PAGE_SOURCES = {
  home: "components/home/home-screen.tsx",
  customers: "app/(workspace)/customers/page.tsx",
  customerDetail: "app/(workspace)/customers/[id]/page.tsx",
  newVisit: "app/(workspace)/visits/new/page.tsx",
  visitDetail: "app/(workspace)/visits/[id]/page.tsx",
  visits: "app/(workspace)/visits/page.tsx",
  newQuote: "components/proposals/new-proposal-form.tsx",
  quickQuote: "components/proposals/mobile-quote-capture.tsx",
  proposalDetail: "components/proposals/proposal-workspace.tsx",
  calendar: "components/calendar/calendar-screen.tsx",
  schedule: "components/proposals/schedule-workspace.tsx",
  settings: "app/(workspace)/settings/page.tsx",
  more: "app/(workspace)/more/page.tsx",
  proposalsList: "app/(workspace)/proposals/page.tsx",
  newCustomer: "app/(workspace)/customers/new/page.tsx",
  editCustomer: "app/(workspace)/customers/[id]/edit/page.tsx",
  enquiries: "app/(workspace)/enquiries/page.tsx",
  enquiryDetail: "app/(workspace)/enquiries/[id]/page.tsx",
  quotePrep: "components/proposals/quote-preparation-form.tsx",
  createVisit: "components/visits/create-visit-form.tsx",
  visitDetailView: "components/visits/visit-detail-view.tsx",
} as const;

export const TRADER_PORTAL_LAYOUT_SOURCES = [
  "app/customer/layout.tsx",
  "app/p/[token]/page.tsx",
  "app/customer-journey.css",
] as const;

export function traderPageUsesCanonicalMobileWidth(): boolean {
  return (
    TRADER_MOBILE_PAGE_LAYOUT.pagePaddingToken ===
      "var(--page-padding-mobile)" &&
    TRADER_MOBILE_PAGE_LAYOUT.extraInlinePadding === "0" &&
    TRADER_MOBILE_PAGE_LAYOUT.maxWidth === "100%" &&
    TRADER_MOBILE_PAGE_LAYOUT.width === "100%" &&
    TRADER_MOBILE_PAGE_LAYOUT.minWidth === "0" &&
    !TRADER_MOBILE_PAGE_LAYOUT.appliesToCustomerPortal
  );
}

/** True when a page root still adds its own mobile side padding. */
export function pageSourceHasDuplicateMobilePadding(source: string): boolean {
  return /(?<!lg:)(?:sm:)?px-[456]\b/.test(source);
}

export function pageSourceUsesTraderPageClass(source: string): boolean {
  return source.includes(TRADER_MOBILE_PAGE_CLASS);
}
