import { DESKTOP_SIDEBAR_ITEMS } from "@/lib/layout/app-nav";

export const MOBILE_NEW_MENU_TITLE = "New";

export const MOBILE_NEW_VISIT_HREF = "/visits/new";
export const MOBILE_NEW_QUOTE_HREF = "/proposals/new";

export type MobileNewMenuOption = {
  id: "initial_visit" | "quote";
  label: string;
  subtitle: string;
  href: string;
  createsQuote: boolean;
  createsJob: boolean;
};

export const MOBILE_NEW_MENU_OPTIONS: MobileNewMenuOption[] = [
  {
    id: "initial_visit",
    label: "Initial Visit",
    subtitle: "Arrange a visit to inspect or measure before quoting",
    href: MOBILE_NEW_VISIT_HREF,
    createsQuote: false,
    createsJob: false,
  },
  {
    id: "quote",
    label: "Quote",
    subtitle: "Create a quote now if you already have enough information",
    href: MOBILE_NEW_QUOTE_HREF,
    createsQuote: true,
    createsJob: false,
  },
];

export function mobilePlusOpensNewMenu(): boolean {
  return true;
}

export function getMobileNewMenuOption(
  id: MobileNewMenuOption["id"]
): MobileNewMenuOption {
  const option = MOBILE_NEW_MENU_OPTIONS.find((item) => item.id === id);
  if (!option) {
    throw new Error(`Unknown New menu option: ${id}`);
  }
  return option;
}

/** Saving an Initial Visit only creates a visit record. */
export function initialVisitCreateSideEffects() {
  return {
    createsVisit: true,
    createsQuote: false,
    createsJob: false,
    createsProposal: false,
    appearsOnVisitsList: true,
    appearsOnCalendarAsVisit: true,
    homepageBuckets: ["today_visit", "upcoming_visit"] as const,
  };
}

export function desktopNewNavigation() {
  return {
    visitsHref:
      DESKTOP_SIDEBAR_ITEMS.find((item) => item.href === "/visits")?.href ??
      "/visits",
    newQuoteHref:
      DESKTOP_SIDEBAR_ITEMS.find((item) => item.href === "/proposals/new")
        ?.href ?? "/proposals/new",
    newQuoteLabel:
      DESKTOP_SIDEBAR_ITEMS.find((item) => item.href === "/proposals/new")
        ?.label ?? "New Quote",
  };
}
