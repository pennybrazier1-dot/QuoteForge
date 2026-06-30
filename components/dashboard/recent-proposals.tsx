import Link from "next/link";
import { Card, CardHeading } from "@/components/dashboard/card";
import { formatPenceAsGbp } from "@/lib/proposals/money";

export type RecentProposalItem = {
  id: string;
  proposal_number: string;
  customer_name: string | null;
  title: string;
  rough_notes: string | null;
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

function getJobLabel(proposal: RecentProposalItem): string {
  if (proposal.rough_notes) {
    const firstLine = proposal.rough_notes.split("\n")[0]?.trim();
    if (firstLine) {
      return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
    }
  }

  return proposal.title;
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function RecentProposals({ proposals }: { proposals: RecentProposalItem[] }) {
  if (proposals.length === 0) {
    return (
      <Card>
        <CardHeading title="Recent proposals" />
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle bg-background px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No proposals yet. Create your first proposal.
          </p>
          <Link
            href="/proposals/new"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
          >
            Create proposal
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeading
        title="Recent proposals"
        hint={`${proposals.length} saved`}
      />
      <ul className="mt-4 divide-y divide-border-subtle">
        {proposals.map((proposal) => (
          <li key={proposal.id}>
            <Link
              href={`/proposals/${proposal.id}`}
              className="flex items-center justify-between gap-4 py-3.5 transition-colors first:pt-0 last:pb-0 hover:opacity-90"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-accent">
                  {proposal.proposal_number}
                </p>
                <p className="truncate text-sm font-medium">
                  {proposal.customer_name ?? "Unknown customer"}
                </p>
                <p className="truncate text-xs text-muted">{getJobLabel(proposal)}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatCreatedAt(proposal.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-sm font-medium text-foreground/90">
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
    </Card>
  );
}
