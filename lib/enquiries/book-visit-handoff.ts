/**
 * Enquiry → Visits handoff paths (standalone visits table).
 */

export function buildBookVisitFromEnquiryHref(enquiryId: string): string {
  return `/visits/new?enquiryId=${encodeURIComponent(enquiryId)}`;
}

export function buildCreateQuoteFromEnquiryHref(enquiryId: string): string {
  return `/proposals/new?enquiryId=${encodeURIComponent(enquiryId)}`;
}

export function formatEnquiryCustomerAddress(enquiry: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
}): string {
  return [
    enquiry.addressLine1,
    enquiry.addressLine2,
    enquiry.city,
    enquiry.county,
    enquiry.postcode,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}
