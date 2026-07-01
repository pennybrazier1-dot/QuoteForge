import type { ProposalStatus } from "@/lib/proposals/status";
import { isProposalStatus } from "@/lib/proposals/status";

export type DashboardProposal = {
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

export type DashboardMetrics = {
  total: number;
  accepted: number;
  readyToSend: number;
  declined: number;
  drafts: number;
  sent: number;
};

export type StatTrend = {
  label: string;
  direction: "up" | "down" | "flat";
  sparkline: number[];
};

export type FocusRow = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  tone: "accent" | "amber" | "blue" | "emerald" | "purple";
};

function countByStatus(
  proposals: DashboardProposal[],
  status: ProposalStatus
): number {
  return proposals.filter((proposal) => proposal.status === status).length;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function countCreatedBetween(
  proposals: DashboardProposal[],
  start: Date,
  end: Date
): number {
  return proposals.filter((proposal) => {
    const created = new Date(proposal.created_at);
    return created >= start && created < end;
  }).length;
}

function countStatusBetween(
  proposals: DashboardProposal[],
  status: ProposalStatus,
  start: Date,
  end: Date
): number {
  return proposals.filter((proposal) => {
    if (proposal.status !== status) {
      return false;
    }

    const created = new Date(proposal.created_at);
    return created >= start && created < end;
  }).length;
}

function buildSparkline(
  proposals: DashboardProposal[],
  status?: ProposalStatus
): number[] {
  const today = startOfDay(new Date());
  const points: number[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() - offset);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    points.push(
      status
        ? countStatusBetween(proposals, status, dayStart, dayEnd)
        : countCreatedBetween(proposals, dayStart, dayEnd)
    );
  }

  return points;
}

function buildTrend(
  proposals: DashboardProposal[],
  status?: ProposalStatus
): StatTrend {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - 7);
  const previousStart = new Date(now);
  previousStart.setDate(now.getDate() - 14);

  const current = status
    ? proposals.filter((proposal) => proposal.status === status).length
    : countCreatedBetween(proposals, currentStart, now);
  const previous = status
    ? countStatusBetween(proposals, status, previousStart, currentStart)
    : countCreatedBetween(proposals, previousStart, currentStart);

  let direction: StatTrend["direction"] = "flat";
  let percent = 0;

  if (previous === 0 && current > 0) {
    direction = "up";
    percent = 100;
  } else if (previous > 0) {
    percent = Math.round(((current - previous) / previous) * 100);
    if (percent > 0) {
      direction = "up";
    } else if (percent < 0) {
      direction = "down";
    }
  }

  const prefix =
    direction === "up" ? "↑" : direction === "down" ? "↓" : "•";
  const suffix = percent === 0 ? "0%" : `${Math.abs(percent)}%`;

  return {
    label: `${prefix} ${suffix} vs last 7 days`,
    direction,
    sparkline: buildSparkline(proposals, status),
  };
}

export function getDashboardMetrics(
  proposals: DashboardProposal[]
): DashboardMetrics {
  return {
    total: proposals.length,
    accepted: countByStatus(proposals, "accepted"),
    readyToSend: countByStatus(proposals, "ready_to_send"),
    declined: countByStatus(proposals, "declined"),
    drafts: countByStatus(proposals, "draft"),
    sent: countByStatus(proposals, "sent"),
  };
}

export function getStatTrends(proposals: DashboardProposal[]) {
  return {
    total: buildTrend(proposals),
    accepted: buildTrend(proposals, "accepted"),
    readyToSend: buildTrend(proposals, "ready_to_send"),
    declined: buildTrend(proposals, "declined"),
  };
}

export function getFocusRows(
  proposals: DashboardProposal[],
  metrics: DashboardMetrics
): FocusRow[] {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const acceptedOvernight = proposals.filter((proposal) => {
    if (proposal.status !== "accepted") {
      return false;
    }

    return new Date(proposal.created_at).getTime() >= oneDayAgo;
  }).length;

  const waitingApprovalTotal = proposals
    .filter((proposal) => proposal.status === "ready_to_send")
    .reduce((sum, proposal) => sum + proposal.total_amount, 0);

  const waitingCount = proposals.filter(
    (proposal) => proposal.status === "ready_to_send"
  ).length;

  return [
    {
      id: "ready-to-send",
      href: "/proposals",
      title: `${metrics.readyToSend} proposal${metrics.readyToSend === 1 ? "" : "s"} ready to send`,
      subtitle: "Waiting for your review",
      tone: "accent",
    },
    {
      id: "follow-ups",
      href: "/proposals",
      title: `${metrics.sent} follow-up${metrics.sent === 1 ? "" : "s"} due`,
      subtitle: "Customers waiting for a response",
      tone: "amber",
    },
    {
      id: "drafts",
      href: "/proposals",
      title: `${metrics.drafts} draft${metrics.drafts === 1 ? "" : "s"} to finish`,
      subtitle: "Keep your pipeline moving",
      tone: "blue",
    },
    {
      id: "accepted-overnight",
      href: "/proposals",
      title: `${acceptedOvernight} accepted overnight`,
      subtitle: acceptedOvernight > 0 ? "Great work!" : "No new wins yet today",
      tone: "emerald",
    },
    {
      id: "waiting-approval",
      href: "/proposals",
      title: `£${(waitingApprovalTotal / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })} waiting approval`,
      subtitle: `From ${waitingCount} proposal${waitingCount === 1 ? "" : "s"}`,
      tone: "purple",
    },
  ];
}

export function getProposalHref(proposal: DashboardProposal): string {
  if (isProposalStatus(proposal.status) && proposal.status === "draft") {
    return `/proposals/${proposal.id}/edit`;
  }

  return `/proposals/${proposal.id}`;
}

export function formatDashboardDateRange(): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
