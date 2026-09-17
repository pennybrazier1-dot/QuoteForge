import { MOBILE_FORM_LAYOUT } from "@/lib/layout/mobile-form-layout";
import type { CustomerListView } from "@/lib/customers/lifecycle";

export const CUSTOMER_LIST_MOBILE_REPEATS_VIEW_TITLE = false;
export const CUSTOMER_LIST_MOBILE_SHOWS_OUTER_CARD = false;
export const CUSTOMER_LIST_TABS = [
  "Active",
  "Archived",
  "Scheduled for deletion",
] as const;

export function customerListPageTitle(): "Customers" {
  return "Customers";
}

export function customerListOuterTitle(
  view?: CustomerListView,
  isMobile?: boolean
): string | null {
  void view;
  void isMobile;
  return CUSTOMER_LIST_MOBILE_REPEATS_VIEW_TITLE ? "Active customers" : null;
}

export function customerListUsesHomeWidth(): boolean {
  return (
    MOBILE_FORM_LAYOUT.pagePaddingToken === "var(--page-padding-mobile)" &&
    MOBILE_FORM_LAYOUT.maxWidth === "100%" &&
    !CUSTOMER_LIST_MOBILE_SHOWS_OUTER_CARD
  );
}

export function customerDetailHref(customerId: string): string {
  return `/customers/${customerId}`;
}
