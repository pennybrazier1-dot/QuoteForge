"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProposalStatusBadge } from "@/components/proposals/proposal-status-badge";
import {
  formatProposalCreatedAt,
  getProposalSummaryLabel,
} from "@/lib/proposals/display";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import {
  formatProposalStatus,
  PROPOSAL_STATUSES,
  type ProposalStatus,
} from "@/lib/proposals/status";

export type ProposalListItem = {
  id: string;
  proposal_number: string;
  customer_name: string | null;
  job_summary: string | null;
  rough_notes: string | null;
  title: string;
  status: string;
  total_amount: number;
  created_at: string;
};

type StatusFilter = "all" | ProposalStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  ...PROPOSAL_STATUSES.map((status) => ({
    value: status,
    label: formatProposalStatus(status),
  })),
];

export function ProposalsBrowser({ proposals }: { proposals: ProposalListItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredProposals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return proposals.filter((proposal) => {
      if (statusFilter !== "all" && proposal.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const proposalNumber = proposal.proposal_number.toLowerCase();
      const customerName = proposal.customer_name?.toLowerCase() ?? "";

      return proposalNumber.includes(query) || customerName.includes(query);
    });
  }, [proposals, search, statusFilter]);

  if (proposals.length === 0) {
    return (
      <div className="qf-card px-6 py-12 text-center">
        <p className="text-sm text-muted">No proposals yet.</p>
        <Link
          href="/proposals/new"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
        >
          Create Proposal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="qf-card space-y-5">
        <label className="block">
          <span className="text-sm font-medium">Search proposals</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by proposal number or customer name"
            className="form-input mt-2"
          />
        </label>

        <div>
          <p className="text-sm font-medium">Filter by status</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    isActive
                      ? "bg-accent-soft text-accent"
                      : "bg-white/5 text-muted hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filteredProposals.length === 0 ? (
        <div className="qf-card-inset border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No proposals match your search or filter.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {filteredProposals.map((proposal) => (
            <li key={proposal.id}>
              <Link
                href={`/proposals/${proposal.id}`}
                className="group qf-card flex h-full flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-accent">
                    {proposal.proposal_number}
                  </p>
                  <ProposalStatusBadge status={proposal.status} />
                </div>

                <p className="mt-3 text-base font-semibold tracking-tight">
                  {proposal.customer_name ?? "Unknown customer"}
                </p>

                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {getProposalSummaryLabel(proposal)}
                </p>

                <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                  <p className="text-lg font-semibold tracking-tight">
                    {formatPenceAsGbp(proposal.total_amount)}
                  </p>
                  <p className="text-xs text-muted">
                    {formatProposalCreatedAt(proposal.created_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
