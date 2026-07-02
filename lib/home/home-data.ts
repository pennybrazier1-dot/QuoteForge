import { getProposalSummaryLabel } from "@/lib/proposals/display";
import { isActiveHomeProposal, isProposalStatus } from "@/lib/proposals/status";

export type HomeProposal = {
  id: string;
  proposal_number: string;
  customer_name: string | null;
  title: string;
  job_summary: string | null;
  rough_notes: string | null;
  scope_of_work: string | null;
  job_address: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  sent_at: string | null;
  planned_start_date_text: string | null;
  planned_start_date: string | null;
  estimated_duration: string | null;
};

export type HomeCardStatusTone = "green" | "orange" | "blue" | "purple";

export type HomeCard = {
  id: string;
  href: string;
  proposalNumber: string;
  proposalStatus: string;
  customer: string;
  jobTitle: string;
  timeLabel?: string;
  addressLine?: string;
  status: { label: string; tone: HomeCardStatusTone };
  attentionNote?: string;
  plannedStartDateText: string | null;
  plannedStartDate: string | null;
  estimatedDuration: string | null;
};

export type HomeSectionTone = "green" | "orange" | "blue" | "purple";

export type HomeSection = {
  id: string;
  title: string;
  tone: HomeSectionTone;
  viewAllHref: string;
  cards: HomeCard[];
  emptyMessage: string;
};

export const HOME_SWIPE_SECTION_IDS = new Set([
  "todays-jobs",
  "jobs-needing-attention",
  "quotes-to-finish",
  "quotes-ready-to-send",
]);

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isToday(iso: string | null): boolean {
  if (!iso) {
    return false;
  }

  const date = new Date(iso);
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  return date >= today && date < tomorrow;
}

function proposalHref(proposal: HomeProposal): string {
  if (isProposalStatus(proposal.status) && proposal.status === "draft") {
    return `/proposals/${proposal.id}/edit`;
  }

  return `/proposals/${proposal.id}`;
}

function isJobReady(proposal: HomeProposal): boolean {
  const hasAddress = Boolean(proposal.job_address?.trim());
  const hasScope = Boolean(
    proposal.scope_of_work?.trim() || proposal.job_summary?.trim()
  );

  return hasAddress && hasScope;
}

function jobNeedsAttention(proposal: HomeProposal): boolean {
  if (!isActiveHomeProposal(proposal.status)) {
    return false;
  }

  if (proposal.status === "sent") {
    return true;
  }

  if (proposal.status === "accepted" && !isJobReady(proposal)) {
    return true;
  }

  return false;
}

function formatTimeRange(proposal: HomeProposal): string | undefined {
  const anchor = proposal.accepted_at ?? proposal.sent_at ?? proposal.updated_at;
  if (!anchor) {
    return undefined;
  }

  const date = new Date(anchor);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday(anchor)) {
    return `Today · ${formatter.format(date)}`;
  }

  return formatter.format(date);
}

function buildCard(
  proposal: HomeProposal,
  options: {
    jobTitle?: string;
    status: HomeCard["status"];
    attentionNote?: string;
    includeSchedule?: boolean;
  }
): HomeCard {
  const address = proposal.job_address?.trim();

  return {
    id: proposal.id,
    href: proposalHref(proposal),
    proposalNumber: proposal.proposal_number,
    proposalStatus: proposal.status,
    customer: proposal.customer_name ?? "Customer",
    jobTitle: options.jobTitle ?? proposal.title,
    timeLabel: options.includeSchedule ? formatTimeRange(proposal) : undefined,
    addressLine: address || undefined,
    status: options.status,
    attentionNote: options.attentionNote,
    plannedStartDateText: proposal.planned_start_date_text,
    plannedStartDate: proposal.planned_start_date,
    estimatedDuration: proposal.estimated_duration,
  };
}

export function getGreetingName(fullName: string | null): string {
  if (!fullName?.trim()) {
    return "there";
  }

  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function getTimeGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function getHomeNotificationCount(proposals: HomeProposal[]): number {
  return proposals.filter(jobNeedsAttention).length;
}

export function buildHomeSections(proposals: HomeProposal[]): HomeSection[] {
  const activeProposals = proposals.filter((proposal) =>
    isActiveHomeProposal(proposal.status)
  );

  const accepted = activeProposals.filter(
    (proposal) => proposal.status === "accepted"
  );
  const todaysJobs = accepted.filter(
    (proposal) =>
      isToday(proposal.accepted_at) || isToday(proposal.updated_at)
  );
  const todaysJobSource = todaysJobs.length > 0 ? todaysJobs : accepted.slice(0, 6);

  const todaysJobCards = todaysJobSource.map((proposal) =>
    buildCard(proposal, {
      jobTitle: getProposalSummaryLabel(proposal),
      status: {
        label: isJobReady(proposal) ? "Ready" : "Scheduled",
        tone: "green",
      },
      includeSchedule: true,
    })
  );

  const jobsNeedingAttention = activeProposals
    .filter(jobNeedsAttention)
    .map((proposal) => {
      if (proposal.status === "sent") {
        return buildCard(proposal, {
          jobTitle: getProposalSummaryLabel(proposal),
          status: { label: "Waiting", tone: "orange" },
          attentionNote: "Quote sent — awaiting reply",
          includeSchedule: true,
        });
      }

      return buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Needs info", tone: "orange" },
        attentionNote: "Missing job details",
        includeSchedule: false,
      });
    });

  const quotesToFinish = activeProposals
    .filter((proposal) => proposal.status === "draft")
    .slice(0, 8)
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Draft", tone: "blue" },
      })
    );

  const quotesReadyToSend = activeProposals
    .filter((proposal) => proposal.status === "ready_to_send")
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Ready", tone: "purple" },
        attentionNote: "Send by email",
      })
    );

  const cancelledJobs = proposals
    .filter((proposal) => proposal.status === "cancelled")
    .slice(0, 8)
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Cancelled", tone: "orange" },
      })
    );

  const sections: HomeSection[] = [
    {
      id: "todays-jobs",
      title: "Today's Jobs",
      tone: "green",
      viewAllHref: "/proposals",
      cards: todaysJobCards,
      emptyMessage: "No jobs for today.",
    },
    {
      id: "jobs-needing-attention",
      title: "Jobs Needing Attention",
      tone: "orange",
      viewAllHref: "/proposals",
      cards: jobsNeedingAttention,
      emptyMessage: "Nothing needs attention right now.",
    },
    {
      id: "quotes-to-finish",
      title: "Quotes to Finish",
      tone: "blue",
      viewAllHref: "/proposals",
      cards: quotesToFinish,
      emptyMessage: "No new quotes to work on.",
    },
    {
      id: "quotes-ready-to-send",
      title: "Quotes Ready to Send",
      tone: "purple",
      viewAllHref: "/proposals",
      cards: quotesReadyToSend,
      emptyMessage: "No quotes waiting to send.",
    },
  ];

  if (cancelledJobs.length > 0) {
    sections.push({
      id: "cancelled-jobs",
      title: "Cancelled Jobs",
      tone: "orange",
      viewAllHref: "/proposals",
      cards: cancelledJobs,
      emptyMessage: "No cancelled jobs.",
    });
  }

  return sections;
}
