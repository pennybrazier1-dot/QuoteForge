import Link from "next/link";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { formatCustomerCreatedAt } from "@/lib/customers/format";
import {
  formatProposalStatus,
  getStatusBadgeClass,
} from "@/lib/proposals/status";
import { SectionCard } from "@/components/ui/section-card";

export type CustomerProposalItem = {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  total_amount: number;
  created_at: string;
};

export function CustomerProposals({
  proposals,
}: {
  proposals: CustomerProposalItem[];
}) {
  return (
    <SectionCard>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">Proposals</h3>
        {proposals.length > 0 ? (
          <span className="text-xs text-muted">{proposals.length} saved</span>
        ) : null}
      </div>

      {proposals.length === 0 ? (
        <div className="qf-card-inset mt-6 border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No proposals linked to this customer yet.
          </p>
        </div>
      ) : (
        <ul className="qf-list mt-6">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <Link
                href={`/proposals/${proposal.id}`}
                className="group qf-card-inset flex items-center justify-between gap-4"
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
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(proposal.status)}`}
                  >
                    {formatProposalStatus(proposal.status)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
