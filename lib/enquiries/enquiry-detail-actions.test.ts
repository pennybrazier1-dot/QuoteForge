import { describe, expect, it } from "vitest";
import { shouldShowReviewEnquiryOnDetailPage } from "@/lib/enquiries/enquiry-detail-actions";

describe("enquiry detail actions", () => {
  it("hides Review Enquiry on the detail page", () => {
    expect(shouldShowReviewEnquiryOnDetailPage()).toBe(false);
  });
});
