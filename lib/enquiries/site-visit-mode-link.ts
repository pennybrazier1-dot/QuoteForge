import type { StoredEnquiry } from "@/lib/enquiries/types";

export function buildSiteVisitModePath(
  enquiryId: string,
  visitId?: string | null
): string {
  const base = `/site-visit/${encodeURIComponent(enquiryId)}`;
  if (!visitId) {
    return base;
  }
  return `${base}?visitId=${encodeURIComponent(visitId)}`;
}

export function shouldShowSiteVisitModeLink(enquiry: StoredEnquiry): boolean {
  return (
    enquiry.status === "site_visit_booked" ||
    enquiry.status === "site_visit_completed"
  );
}
