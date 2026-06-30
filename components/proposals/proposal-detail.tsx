import { formatPenceAsGbp } from "@/lib/proposals/money";

export type ProposalDetailData = {
  id: string;
  proposal_number: string;
  status: string;
  title: string;
  job_address: string | null;
  rough_notes: string | null;
  things_to_confirm: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  total_amount: number;
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
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground/90">{value}</dd>
    </div>
  );
}

export function ProposalDetail({ proposal }: { proposal: ProposalDetailData }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-accent">{proposal.proposal_number}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {proposal.title}
            </h2>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium capitalize text-muted">
            {proposal.status}
          </span>
        </div>
        <p className="mt-4 text-sm text-muted">
          Saved on{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(proposal.created_at))}
        </p>
      </div>

      <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Customer</h3>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <DetailRow label="Name" value={proposal.customer_name} />
          <DetailRow label="Phone" value={proposal.customer_phone} />
          <DetailRow label="Email" value={proposal.customer_email} />
          <DetailRow label="Property address" value={proposal.customer_address} />
        </dl>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Job</h3>
        <div className="mt-6 space-y-5">
          <DetailRow label="Job address" value={proposal.job_address} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted">
              Job description
            </dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {proposal.rough_notes}
            </dd>
          </div>
          <DetailRow label="Estimate notes" value={proposal.things_to_confirm} />
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Estimate</h3>
        <p className="mt-4 text-2xl font-semibold tracking-tight">
          {formatPenceAsGbp(proposal.total_amount)}
        </p>
      </section>
    </div>
  );
}
