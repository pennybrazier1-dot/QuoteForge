import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  customerDetailHref,
  customerListOuterTitle,
  customerListPageTitle,
  CUSTOMER_LIST_MOBILE_REPEATS_VIEW_TITLE,
  CUSTOMER_LIST_MOBILE_SHOWS_OUTER_CARD,
  CUSTOMER_LIST_TABS,
  customerListUsesHomeWidth,
} from "@/lib/customers/list-layout";
import {
  customerListRowDisplay,
  customerListSwipeActions,
} from "@/lib/customers/lifecycle";

describe("mobile customers list", () => {
  it("does not repeat Active customers under the Active tab", () => {
    expect(customerListPageTitle()).toBe("Customers");
    expect(CUSTOMER_LIST_TABS).toContain("Active");
    expect(CUSTOMER_LIST_MOBILE_REPEATS_VIEW_TITLE).toBe(false);
    expect(customerListOuterTitle("active", true)).toBeNull();
    expect(CUSTOMER_LIST_MOBILE_SHOWS_OUTER_CARD).toBe(false);
  });

  it("shows only the name and chevron on a mobile row", () => {
    const row = customerListRowDisplay("active", { isMobile: true });
    expect(row.showName).toBe(true);
    expect(row.showChevron).toBe(true);
    expect(row.showEmail).toBe(false);
    expect(row.showPhone).toBe(false);
    expect(row.showAddedDate).toBe(false);
  });

  it("keeps Home-width rows and opens Customer Detail", () => {
    expect(customerListUsesHomeWidth()).toBe(true);
    expect(customerDetailHref("cust-1")).toBe("/customers/cust-1");
    expect(customerListSwipeActions("active")).toEqual(["archive", "delete"]);
  });

  it("does not wrap the mobile list in an Active customers card heading", () => {
    const source = readFileSync(
      join(process.cwd(), "components/customers/customer-list.tsx"),
      "utf8"
    );
    expect(source).not.toContain("<Card>");
    expect(source).toContain("customerListOuterTitle");
    expect(source).toContain("customerDetailHref");
    expect(source).toContain("CustomerRowChevron");
  });
});
