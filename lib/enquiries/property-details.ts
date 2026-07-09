import type { StoredEnquiry } from "@/lib/enquiries/types";

export type EnquiryPropertyDetailRow = {
  label: string;
  value: string;
};

export function formatEnquiryStreetAddress(enquiry: {
  addressLine1: string;
  addressLine2: string;
}): string {
  return [enquiry.addressLine1, enquiry.addressLine2]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function getEnquiryPropertyDetailRows(
  enquiry: Pick<
    StoredEnquiry,
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "county"
    | "postcode"
    | "propertyType"
  >
): EnquiryPropertyDetailRow[] {
  const streetAddress = formatEnquiryStreetAddress(enquiry);

  return [
    {
      label: "Address",
      value: streetAddress || "Not provided",
    },
    {
      label: "Town / City",
      value: enquiry.city.trim() || "Not provided",
    },
    {
      label: "County",
      value: enquiry.county.trim() || "Not provided",
    },
    {
      label: "Postcode",
      value: enquiry.postcode.trim() || "Not provided",
    },
    {
      label: "Property type",
      value: enquiry.propertyType || "Not provided",
    },
  ];
}
