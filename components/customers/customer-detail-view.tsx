import {
  formatCustomerAddress,
  formatCustomerCreatedAt,
} from "@/lib/customers/format";
import { CustomerNotesSection } from "@/components/customers/customer-notes-section";
import { SectionCard, SectionStack } from "@/components/ui/section-card";
import Link from "next/link";

export type CustomerDetailData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  notes: string | null;
  created_at: string;
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }

  return (
    <SectionCard as="div" variant="inset">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm text-foreground/90">{value}</dd>
    </SectionCard>
  );
}

export function CustomerDetailView({ customer }: { customer: CustomerDetailData }) {
  const address = formatCustomerAddress(customer);
  const hasContactDetails = Boolean(
    customer.email || customer.phone || address
  );

  return (
    <SectionStack>
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              Customer
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              {customer.name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Customer since {formatCustomerCreatedAt(customer.created_at)}
            </p>
          </div>
          <Link
            href={`/customers/${customer.id}/edit`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-subtle bg-white/5 px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
          >
            Edit Customer
          </Link>
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="text-lg font-semibold">Contact details</h3>
        {hasContactDetails ? (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Phone" value={customer.phone} />
            <div className="sm:col-span-2">
              <DetailRow label="Address" value={address} />
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted">
            No contact details saved yet.
          </p>
        )}
      </SectionCard>

      <CustomerNotesSection customerId={customer.id} notes={customer.notes} />
    </SectionStack>
  );
}
