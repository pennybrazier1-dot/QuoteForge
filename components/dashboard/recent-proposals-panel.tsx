import Link from "next/link";
import {
  formatProposalCreatedAt,
  getProposalSummaryLabel,
} from "@/lib/proposals/display";
import {
  getProposalHref,
  type DashboardProposal,
} from "@/lib/dashboard/metrics";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import {
  formatProposalStatus,
  getStatusBadgeClass,
} from "@/lib/proposals/status";

const MAX_ROWS = 5;

export function RecentProposalsPanel({
  proposals,
}: {
  proposals: DashboardProposal[];
}) {
  const rows = proposals.slice(0, MAX_ROWS);

  return (
    <section className="qf-dash-card qf-dash-panel">
      <div className="qf-dash-panel-header">
        <h2 className="qf-dash-section-title">Recent Proposals</h2>
        <Link href="/proposals" className="qf-dash-link">
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="qf-dash-empty">
          <p className="qf-dash-body-muted">No proposals yet.</p>
          <Link href="/proposals/new" className="qf-dash-button">
            Create New Proposal
          </Link>
        </div>
      ) : (
        <>
          <div className="qf-dash-table-wrap">
            <table className="qf-dash-table">
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>Customer</th>
                  <th className="qf-dash-hide-sm">Job Summary</th>
                  <th>Price</th>
                  <th className="qf-dash-hide-sm">Date</th>
                  <th>Status</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.map((proposal) => (
                  <tr key={proposal.id}>
                    <td>
                      <Link
                        href={getProposalHref(proposal)}
                        className="qf-dash-table-link"
                      >
                        {proposal.proposal_number}
                      </Link>
                    </td>
                    <td className="qf-dash-table-customer">
                      {proposal.customer_name ?? "Unknown customer"}
                    </td>
                    <td className="qf-dash-hide-sm qf-dash-table-summary">
                      {getProposalSummaryLabel(proposal)}
                    </td>
                    <td>{formatPenceAsGbp(proposal.total_amount)}</td>
                    <td className="qf-dash-hide-sm qf-dash-table-date">
                      {formatProposalCreatedAt(proposal.created_at)}
                    </td>
                    <td>
                      <span
                        className={`qf-dash-badge ${getStatusBadgeClass(proposal.status)}`}
                      >
                        {formatProposalStatus(proposal.status)}
                      </span>
                    </td>
                    <td className="qf-dash-table-chevron">
                      <Link
                        href={getProposalHref(proposal)}
                        className="qf-dash-row-link"
                        aria-label={`Open ${proposal.proposal_number}`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="qf-dash-panel-footer">
            <Link href="/proposals" className="qf-dash-link">
              View all proposals
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
