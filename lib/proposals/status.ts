export const PROPOSAL_STATUSES = [
  "draft",
  "ready_to_send",
  "sent",
  "accepted",
  "declined",
  "expired",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["ready_to_send"],
  ready_to_send: ["sent"],
  sent: ["accepted", "declined"],
  accepted: [],
  declined: [],
  expired: [],
};

export function isProposalStatus(value: string): value is ProposalStatus {
  return (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export function canTransitionStatus(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function formatProposalStatus(status: string): string {
  if (status === "ready_to_send") {
    return "Ready to send";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getProposalPageTitle(status: string): string {
  switch (status) {
    case "draft":
      return "Draft Proposal";
    case "ready_to_send":
      return "Ready to Send";
    case "sent":
      return "Sent Proposal";
    case "accepted":
      return "Accepted Proposal";
    case "declined":
      return "Declined Proposal";
    case "expired":
      return "Expired Proposal";
    default:
      return "Proposal";
  }
}

export const STATUS_BADGE_STYLES: Record<ProposalStatus, string> = {
  draft: "bg-white/5 text-muted",
  ready_to_send: "bg-accent/10 text-accent",
  sent: "bg-accent-soft text-accent",
  accepted: "bg-emerald-500/10 text-emerald-400",
  declined: "bg-red-500/10 text-red-400",
  expired: "bg-white/5 text-muted",
};

export function getStatusBadgeClass(status: string): string {
  if (isProposalStatus(status)) {
    return STATUS_BADGE_STYLES[status];
  }

  return STATUS_BADGE_STYLES.draft;
}
