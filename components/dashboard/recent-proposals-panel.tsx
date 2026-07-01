import Link from "next/link";
import {
  formatProposalCreatedAt,
  getProposalSummaryLabel,
} from "@/lib/proposals/display";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import {
  formatProposalStatus,
  getStatusBadgeClass,
} from "@/lib/proposals/status";

export type RecentProposalItem = {
  id: string;
  proposal_number: string;
  customer_name: string | null;
  title: string;
  job_summary: string | null;
  rough_notes: string | null;
  status: string;
  total_amount: number;
  created_at: string;
};

export function RecentProposalsPanel({ proposals }: { proposals: RecentProposalItem[] }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Recent proposals</h2>
        {proposals.length > 0 ? (
          <Link
            href="/proposals"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            View all →
          </Link>
        ) : null}
      </div>

      {proposals.length === 0 ? (
        <div className="qf-card mt-4 border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted">No proposals yet.</p>
          <Link
            href="/proposals/new"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-accent px-8 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
          >
            Start New Proposal
          </Link>
        </div>
      ) : (
        <ul className="qf-workspace-proposals-grid mt-4">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <Link href={`/proposals/${proposal.id}`} className="qf-card qf-card-compact block h-full">
                <p className="text-xs font-medium text-accent">{proposal.proposal_number}</p>
                <p className="mt-1 truncate text-sm font-semibold tracking-tight">
                  {proposal.customer_name ?? "Unknown customer"}
                </p>
                <p className="mt-1 truncate text-xs text-muted">
                  {getProposalSummaryLabel(proposal)}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {formatPenceAsGbp(proposal.total_amount)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${getStatusBadgeClass(proposal.status)}`}
                  >
                    {formatProposalStatus(proposal.status)}
                  </span>
                  <span className="text-xs text-muted">
                    {formatProposalCreatedAt(proposal.created_at)}
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
