import { formatCustomerAddress } from "@/lib/customers/format";

export type CustomerFormValues = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

type CustomerRecord = {
  name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  notes: string | null;
};

export function customerToFormValues(customer: CustomerRecord): CustomerFormValues {
  return {
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: formatCustomerAddress(customer) ?? "",
    notes: customer.notes ?? "",
  };
}
