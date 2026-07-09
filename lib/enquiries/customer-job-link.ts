import { getSiteUrl } from "@/lib/env/site-url";
import type { StoredEnquiry } from "@/lib/enquiries/types";

export function buildCustomerJobPath(enquiryId: string): string {
  return `/customer/job/${encodeURIComponent(enquiryId)}`;
}

export function resolveCustomerJobOrigin(origin?: string): string {
  if (origin?.trim()) {
    return origin.trim().replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return getSiteUrl();
}

export function buildCustomerJobUrl(enquiryId: string, origin?: string): string {
  return `${resolveCustomerJobOrigin(origin)}${buildCustomerJobPath(enquiryId)}`;
}

export function shouldShowCustomerJobLink(enquiry: StoredEnquiry): boolean {
  return enquiry.status === "site_visit_booked";
}
