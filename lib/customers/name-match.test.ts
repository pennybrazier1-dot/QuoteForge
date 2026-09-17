import { describe, expect, it } from "vitest";
import {
  customerMatchAddressLine,
  findCustomersByTypedName,
} from "@/lib/customers/name-match";

const sarah = {
  id: "cust-sarah",
  name: "Sarah Jones",
  email: "sarah@email.com",
  phone: "07700 900123",
  address_line_1: "12 High Street",
  town: "Leeds",
  postcode: "LS1 1AA",
};

const sam = {
  id: "cust-sam",
  name: "Sam Jones",
  email: "sam@email.com",
  phone: null,
};

const archived = {
  id: "cust-old",
  name: "Sarah Old",
  email: "old@email.com",
  phone: null,
  archived_at: "2026-01-01T00:00:00.000Z",
};

describe("customer name match", () => {
  it("suggests a saved customer while typing a name", () => {
    const matches = findCustomersByTypedName("Sar", [sarah, sam, archived]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("cust-sarah");
    expect(customerMatchAddressLine(sarah)).toContain("12 High Street");
  });

  it("does not suggest until enough of the name is typed", () => {
    expect(findCustomersByTypedName("s", [sarah])).toEqual([]);
  });

  it("hides archived customers and lets the form continue when nothing matches", () => {
    expect(findCustomersByTypedName("sarah", [archived])).toEqual([]);
    expect(findCustomersByTypedName("Michael", [sarah])).toEqual([]);
  });
});
