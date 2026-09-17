import { formatCustomerAddress } from "@/lib/customers/format";

export const CUSTOMER_NAME_MATCH_MIN_CHARS = 2;
export const CUSTOMER_NAME_MATCH_MAX_RESULTS = 3;

export type CustomerNameMatchOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  archived_at?: string | null;
  anonymised_at?: string | null;
  deletion_requested_at?: string | null;
};

export function isCustomerAvailableForNameMatch(
  customer: CustomerNameMatchOption
): boolean {
  return (
    Boolean(customer.name?.trim()) &&
    !customer.archived_at &&
    !customer.anonymised_at &&
    !customer.deletion_requested_at
  );
}

export function customerMatchAddressLine(
  customer: CustomerNameMatchOption
): string | null {
  return formatCustomerAddress(customer);
}

export function findCustomersByTypedName(
  query: string,
  customers: CustomerNameMatchOption[]
): CustomerNameMatchOption[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < CUSTOMER_NAME_MATCH_MIN_CHARS) {
    return [];
  }

  return customers
    .filter((customer) => isCustomerAvailableForNameMatch(customer))
    .filter((customer) => customer.name.toLowerCase().includes(needle))
    .sort((left, right) => {
      const leftName = left.name.toLowerCase();
      const rightName = right.name.toLowerCase();
      const leftStarts = leftName.startsWith(needle) ? 0 : 1;
      const rightStarts = rightName.startsWith(needle) ? 0 : 1;
      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, CUSTOMER_NAME_MATCH_MAX_RESULTS);
}
