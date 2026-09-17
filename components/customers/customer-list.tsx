import Link from "next/link";
import { Card, CardHeading } from "@/components/ui/section-card";
import {
  formatCustomerAddress,
  formatCustomerCreatedAt,
} from "@/lib/customers/format";
import {
  formatDeletionScheduledFor,
  type CustomerListView,
} from "@/lib/customers/lifecycle";

export type CustomerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  created_at: string;
  activated_at?: string | null;
  archived_at?: string | null;
  deletion_requested_at?: string | null;
  deletion_scheduled_for?: string | null;
};

const VIEW_COPY: Record<
  CustomerListView,
  { title: string; empty: string; countLabel: string }
> = {
  active: {
    title: "Active customers",
    empty:
      "No active customers yet. People appear here when a proposal is accepted and a job is booked, or when you add someone yourself.",
    countLabel: "active",
  },
  archived: {
    title: "Archived customers",
    empty: "No archived customers.",
    countLabel: "archived",
  },
  scheduled: {
    title: "Scheduled for deletion",
    empty: "No customers are waiting to be deleted.",
    countLabel: "scheduled",
  },
};

function CustomerMeta({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex gap-2 text-sm">
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 break-words text-foreground/90">{value}</span>
    </div>
  );
}

export function CustomerList({
  customers,
  view,
}: {
  customers: CustomerListItem[];
  view: CustomerListView;
}) {
  const copy = VIEW_COPY[view];

  if (customers.length === 0) {
    return (
      <Card>
        <CardHeading title={copy.title} />
        <div className="qf-card-inset mt-6 border-dashed px-6 py-12 text-center">
          <p className="text-sm text-muted">{copy.empty}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <span className="text-xs text-muted">
          {customers.length} {copy.countLabel}
        </span>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {customers.map((customer) => {
          const address = formatCustomerAddress(customer);
          const deletionDate = formatDeletionScheduledFor(
            customer.deletion_scheduled_for
          );

          return (
            <li key={customer.id}>
              <Link
                href={`/customers/${customer.id}`}
                className="group qf-card flex h-full flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-base font-semibold tracking-tight">
                    {customer.name}
                  </p>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-muted transition-colors group-hover:text-accent"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>

                {(customer.email || customer.phone || address) && (
                  <div className="mt-4 space-y-1.5">
                    <CustomerMeta label="Email" value={customer.email} />
                    <CustomerMeta label="Phone" value={customer.phone} />
                    <CustomerMeta label="Address" value={address} />
                  </div>
                )}

                <p className="mt-auto pt-4 text-xs text-muted">
                  {deletionDate
                    ? `Deletion scheduled ${deletionDate}`
                    : `Added ${formatCustomerCreatedAt(customer.created_at)}`}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
