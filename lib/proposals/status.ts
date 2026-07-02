export const LIFECYCLE_PROPOSAL_STATUSES = [
  "draft",
  "ready_to_send",
  "waiting_for_customer",
  "needs_attention",
  "booked",
  "completed",
  "cancelled",
] as const;

export type LifecycleProposalStatus =
  (typeof LIFECYCLE_PROPOSAL_STATUSES)[number];

export const RESERVED_PROPOSAL_STATUSES = ["invoiced", "paid"] as const;

export type ReservedProposalStatus =
  (typeof RESERVED_PROPOSAL_STATUSES)[number];

export const LEGACY_PROPOSAL_STATUSES = ["declined", "expired"] as const;

export type LegacyProposalStatus = (typeof LEGACY_PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUSES = [
  ...LIFECYCLE_PROPOSAL_STATUSES,
  ...RESERVED_PROPOSAL_STATUSES,
  ...LEGACY_PROPOSAL_STATUSES,
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const EDITABLE_PROPOSAL_STATUSES = [
  "draft",
  "ready_to_send",
] as const satisfies readonly ProposalStatus[];

export type EditableProposalStatus =
  (typeof EDITABLE_PROPOSAL_STATUSES)[number];

const LEGACY_STATUS_ALIASES: Record<string, ProposalStatus> = {
  sent: "waiting_for_customer",
  accepted: "booked",
  in_progress: "booked",
};

export function normalizeProposalStatus(status: string): string {
  return LEGACY_STATUS_ALIASES[status] ?? status;
}

export function canEditProposal(status: string): status is EditableProposalStatus {
  return (EDITABLE_PROPOSAL_STATUSES as readonly string[]).includes(
    normalizeProposalStatus(status)
  );
}

const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["ready_to_send", "cancelled"],
  ready_to_send: ["waiting_for_customer", "cancelled"],
  waiting_for_customer: ["needs_attention", "booked", "cancelled"],
  needs_attention: ["waiting_for_customer", "booked", "cancelled"],
  booked: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  invoiced: [],
  paid: [],
  declined: ["cancelled"],
  expired: ["cancelled"],
};

export function canCancelProposal(status: string): boolean {
  const normalized = normalizeProposalStatus(status);

  return (
    isProposalStatus(normalized) &&
    normalized !== "cancelled" &&
    normalized !== "completed" &&
    normalized !== "invoiced" &&
    normalized !== "paid"
  );
}

export function isActiveHomeProposal(status: string): boolean {
  const normalized = normalizeProposalStatus(status);

  return (
    normalized !== "cancelled" &&
    normalized !== "completed" &&
    normalized !== "invoiced" &&
    normalized !== "paid" &&
    normalized !== "declined" &&
    normalized !== "expired"
  );
}

export function isProposalStatus(value: string): value is ProposalStatus {
  return (PROPOSAL_STATUSES as readonly string[]).includes(
    normalizeProposalStatus(value) as ProposalStatus
  );
}

export function canTransitionStatus(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function formatProposalStatus(status: string): string {
  switch (normalizeProposalStatus(status)) {
    case "ready_to_send":
      return "Ready to Send";
    case "waiting_for_customer":
      return "Waiting for Customer";
    case "needs_attention":
      return "Jobs Needing Attention";
    case "cancelled":
      return "Cancelled";
    case "invoiced":
      return "Invoiced";
    case "paid":
      return "Paid";
    default:
      return status
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

export function getProposalPageTitle(status: string): string {
  switch (normalizeProposalStatus(status)) {
    case "draft":
      return "Draft Proposal";
    case "ready_to_send":
      return "Ready to Send";
    case "waiting_for_customer":
      return "Waiting for Customer";
    case "needs_attention":
      return "Needs Your Attention";
    case "booked":
      return "Booked Job";
    case "completed":
      return "Completed Job";
    case "invoiced":
      return "Invoiced Job";
    case "paid":
      return "Paid Job";
    case "declined":
      return "Declined Proposal";
    case "expired":
      return "Expired Proposal";
    case "cancelled":
      return "Cancelled Proposal";
    default:
      return "Proposal";
  }
}

export const STATUS_BADGE_STYLES: Record<LifecycleProposalStatus, string> = {
  draft: "bg-white/5 text-muted",
  ready_to_send: "bg-accent/10 text-accent",
  waiting_for_customer: "bg-amber-500/10 text-amber-300",
  needs_attention: "bg-orange-500/10 text-orange-300",
  booked: "bg-emerald-500/10 text-emerald-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-white/5 text-zinc-400",
};

const RESERVED_STATUS_BADGE_STYLES: Record<ReservedProposalStatus, string> = {
  invoiced: "bg-sky-500/10 text-sky-300",
  paid: "bg-emerald-500/10 text-emerald-400",
};

const LEGACY_STATUS_BADGE_STYLES: Record<LegacyProposalStatus, string> = {
  declined: "bg-red-500/10 text-red-400",
  expired: "bg-white/5 text-muted",
};

export function getStatusBadgeClass(status: string): string {
  const normalized = normalizeProposalStatus(status);

  if (
    (LIFECYCLE_PROPOSAL_STATUSES as readonly string[]).includes(normalized)
  ) {
    return STATUS_BADGE_STYLES[normalized as LifecycleProposalStatus];
  }

  if ((RESERVED_PROPOSAL_STATUSES as readonly string[]).includes(normalized)) {
    return RESERVED_STATUS_BADGE_STYLES[normalized as ReservedProposalStatus];
  }

  if ((LEGACY_PROPOSAL_STATUSES as readonly string[]).includes(normalized)) {
    return LEGACY_STATUS_BADGE_STYLES[normalized as LegacyProposalStatus];
  }

  return STATUS_BADGE_STYLES.draft;
}

export function isQuotePhaseStatus(status: string): boolean {
  const normalized = normalizeProposalStatus(status);

  return (
    normalized === "draft" ||
    normalized === "ready_to_send" ||
    normalized === "waiting_for_customer" ||
    normalized === "needs_attention"
  );
}

export function isJobPhaseStatus(status: string): boolean {
  const normalized = normalizeProposalStatus(status);

  return (
    normalized === "booked" ||
    normalized === "completed" ||
    normalized === "invoiced" ||
    normalized === "paid"
  );
}
