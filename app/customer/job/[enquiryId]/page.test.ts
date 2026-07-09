import { describe, expect, it } from "vitest";
import CustomerJobPage from "@/app/customer/job/[enquiryId]/page";

describe("customer job page route", () => {
  it("exports a page component for /customer/job/[enquiryId]", () => {
    expect(CustomerJobPage).toBeTypeOf("function");
  });
});
