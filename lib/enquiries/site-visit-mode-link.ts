import type { StoredEnquiry } from "@/lib/enquiries/types";

export function buildSiteVisitModePath(enquiryId: string): string {
  return `/site-visit/${encodeURIComponent(enquiryId)}`;
}

export function shouldShowSiteVisitModeLink(enquiry: StoredEnquiry): boolean {
  return (
    enquiry.status === "site_visit_booked" ||
    enquiry.status === "site_visit_completed"
  );
}
