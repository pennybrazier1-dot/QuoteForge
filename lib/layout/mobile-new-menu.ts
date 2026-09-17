import { DESKTOP_SIDEBAR_ITEMS } from "@/lib/layout/app-nav";
import { visitCreateSideEffects } from "@/lib/visits/new-visit";

export { visitCreateSideEffects };

export const MOBILE_NEW_MENU_TITLE = "New";

/** Same Reanvil orange / charcoal tokens as Home and proposal cards. */
export const MOBILE_NEW_MENU_VISUAL = {
  sheetBorderToken: "var(--card-border-color)",
  optionBorderToken: "var(--card-border-color)",
  accentToken: "var(--accent)",
  sheetBackgroundToken: "var(--background-card)",
  optionBackgroundToken: "var(--background-card-inset)",
  radiusToken: "var(--radius-card)",
  pagePaddingToken: "var(--page-padding-mobile)",
} as const;

export const MOBILE_NEW_VISIT_HREF = "/visits/new";
export const MOBILE_NEW_QUOTE_HREF = "/proposals/new";

export type MobileNewMenuOption = {
  id: "visit" | "quote";
  label: string;
  subtitle: string;
  href: string;
  createsQuote: boolean;
  createsJob: boolean;
};

export const MOBILE_NEW_MENU_OPTIONS: MobileNewMenuOption[] = [
  {
    id: "visit",
    label: "Visit",
    subtitle: "Arrange a visit to inspect, discuss or check work",
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
