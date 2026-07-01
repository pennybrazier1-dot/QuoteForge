import {
  formatProposalStatus,
  isProposalStatus,
  type ProposalStatus,
} from "@/lib/proposals/status";

export type AdminTaskProposal = {
  id: string;
  proposal_number: string;
  customer_name: string | null;
  status: string;
};

export type AdminTask = {
  id: string;
  proposalId: string;
  proposalNumber: string;
  customerName: string;
  href: string;
  status: ProposalStatus;
};

function getTaskHref(status: ProposalStatus, proposalId: string): string {
  if (status === "draft") {
    return `/proposals/${proposalId}/edit`;
  }

  return `/proposals/${proposalId}`;
}

export function buildAdminTasks(proposals: AdminTaskProposal[]): AdminTask[] {
  const priority: ProposalStatus[] = [
    "ready_to_send",
    "sent",
    "draft",
    "accepted",
    "declined",
    "expired",
  ];

  const actionable = proposals.filter((proposal) =>
    isProposalStatus(proposal.status)
  ) as Array<AdminTaskProposal & { status: ProposalStatus }>;

  actionable.sort((left, right) => {
    return priority.indexOf(left.status) - priority.indexOf(right.status);
  });

  return actionable.map((proposal) => ({
    id: `${proposal.status}-${proposal.id}`,
    proposalId: proposal.id,
    proposalNumber: proposal.proposal_number,
    customerName: proposal.customer_name ?? "Unknown customer",
    href: getTaskHref(proposal.status, proposal.id),
    status: proposal.status,
  }));
}

export function formatAdminTaskStatus(status: ProposalStatus): string {
  return formatProposalStatus(status);
}
