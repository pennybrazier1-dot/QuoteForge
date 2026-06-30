import {
  formatCustomerAddress,
  formatCustomerCreatedAt,
} from "@/lib/customers/format";

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
    <div className="rounded-xl border border-border-subtle bg-background p-4">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm text-foreground/90">{value}</dd>
    </div>
  );
}

export function CustomerDetailView({ customer }: { customer: CustomerDetailData }) {
  const address = formatCustomerAddress(customer);
  const hasContactDetails = Boolean(
    customer.email || customer.phone || address
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Customer
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          {customer.name}
        </h2>
        <p className="mt-2 text-sm text-muted">
          Customer since {formatCustomerCreatedAt(customer.created_at)}
        </p>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
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
      </section>

      <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Notes</h3>
        {customer.notes ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {customer.notes}
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">No notes yet.</p>
        )}
      </section>
    </div>
  );
}
