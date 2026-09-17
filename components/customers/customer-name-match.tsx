"use client";

import {
  customerMatchAddressLine,
  findCustomersByTypedName,
  type CustomerNameMatchOption,
} from "@/lib/customers/name-match";

export function CustomerNameMatch({
  query,
  customers,
  selectedCustomerId,
  onUseCustomer,
}: {
  query: string;
  customers: CustomerNameMatchOption[];
  selectedCustomerId?: string | null;
  onUseCustomer: (customer: CustomerNameMatchOption) => void;
}) {
  const matches = findCustomersByTypedName(query, customers).filter(
    (customer) => customer.id !== selectedCustomerId
  );

  if (matches.length === 0) {
    return null;
  }

  return (
    <ul className="qf-customer-match" aria-label="Saved customers">
      {matches.map((customer) => {
        const address = customerMatchAddressLine(customer);
        return (
          <li key={customer.id}>
            <button
              type="button"
              className="qf-customer-match-card"
              onClick={() => onUseCustomer(customer)}
            >
              <p className="qf-customer-match-name">{customer.name}</p>
              {customer.email ? (
                <p className="qf-customer-match-meta">{customer.email}</p>
              ) : null}
              {address ? (
                <p className="qf-customer-match-meta">{address}</p>
              ) : null}
              <span className="qf-btn-secondary qf-customer-match-use">
                Use this customer
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
