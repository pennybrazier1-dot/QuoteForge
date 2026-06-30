import Link from "next/link";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { formatCustomerCreatedAt } from "@/lib/customers/format";

export type CustomerProposalItem = {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  total_amount: number;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/5 text-muted",
  sent: "bg-accent-soft text-accent",
  accepted: "bg-emerald-500/10 text-emerald-400",
  declined: "bg-red-500/10 text-red-400",
  expired: "bg-white/5 text-muted",
};

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function CustomerProposals({
  proposals,
}: {
  proposals: CustomerProposalItem[];
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">Proposals</h3>
        {proposals.length > 0 ? (
          <span className="text-xs text-muted">{proposals.length} saved</span>
        ) : null}
      </div>

      {proposals.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle bg-background px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No proposals linked to this customer yet.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <Link
                href={`/proposals/${proposal.id}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-background p-4 transition-colors hover:border-accent/40 sm:p-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-accent">
                    {proposal.proposal_number}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {proposal.title}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {formatCustomerCreatedAt(proposal.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-sm font-semibold text-foreground/90">
                    {formatPenceAsGbp(proposal.total_amount)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLES[proposal.status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {formatStatus(proposal.status)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
