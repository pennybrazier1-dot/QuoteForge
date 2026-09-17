import {
  formatCustomerAddress,
  formatCustomerCreatedAt,
} from "@/lib/customers/format";
import { CustomerNotesSection } from "@/components/customers/customer-notes-section";
import { CustomerLifecycleActions } from "@/components/customers/customer-lifecycle-actions";
import { SectionCard, SectionStack } from "@/components/ui/section-card";
import {
  customerDetailActions,
  readCustomerLifecycleState,
} from "@/lib/customers/lifecycle";

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
  activated_at?: string | null;
  archived_at?: string | null;
  deletion_requested_at?: string | null;
  deletion_scheduled_for?: string | null;
  anonymised_at?: string | null;
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

function lifecycleLabel(state: ReturnType<typeof readCustomerLifecycleState>) {
  if (state === "archived") {
    return "Archived customer";
  }
  if (state === "scheduled_for_deletion") {
    return "Scheduled for deletion";
  }
  return "Customer";
}

export function CustomerDetailView({ customer }: { customer: CustomerDetailData }) {
  const address = formatCustomerAddress(customer);
  const hasContactDetails = Boolean(
    customer.email || customer.phone || address
  );
  const state = readCustomerLifecycleState(customer);
  const actions = customerDetailActions(state);

  return (
    <SectionStack>
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              {lifecycleLabel(state)}
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              {customer.name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Customer since {formatCustomerCreatedAt(customer.created_at)}
            </p>
          </div>
          <CustomerLifecycleActions
            customerId={customer.id}
            deletionScheduledFor={customer.deletion_scheduled_for}
            actions={actions}
          />
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

      {state !== "anonymised" ? (
        <CustomerNotesSection customerId={customer.id} notes={customer.notes} />
      ) : null}
    </SectionStack>
  );
}
