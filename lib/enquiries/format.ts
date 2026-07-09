export function formatEnquiryAddress(enquiry: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  county?: string;
  postcode: string;
}): string {
  return [
    enquiry.addressLine1,
    enquiry.addressLine2,
    enquiry.city,
    enquiry.county ?? "",
    enquiry.postcode,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function formatEnquiryReceivedDate(iso: string): string {
  const date = new Date(iso);

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEnquiryTimelineDate(iso: string): string {
  const date = new Date(iso);

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
