type CustomerAddressFields = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
};

export function formatCustomerAddress(
  customer: CustomerAddressFields
): string | null {
  const parts = [
    customer.address_line_1,
    customer.address_line_2,
    customer.town,
    customer.county,
    customer.postcode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatCustomerCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}
