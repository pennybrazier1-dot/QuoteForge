import {
  formatProposalStatus,
  getStatusBadgeClass,
} from "@/lib/proposals/status";

export function ProposalStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(status)}`}
    >
      {formatProposalStatus(status)}
    </span>
  );
}
