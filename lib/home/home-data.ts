import { getProposalSummaryLabel } from "@/lib/proposals/display";
import { formatAttentionReason } from "@/lib/proposals/attention";
import { isConfirmedBooking, isProvisionalBooking } from "@/lib/proposals/booking";
import {
  isPlannedStartToday,
  isPlannedStartInFuture,
} from "@/lib/proposals/lifecycle";
import {
  isActiveHomeProposal,
  isProposalStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";

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
  attention_reason: string | null;
  booking_confirmation: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  sent_at: string | null;
  booked_at: string | null;
  completed_at: string | null;
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
  "waiting-for-customer",
  "quotes-to-finish",
  "quotes-ready-to-send",
  "booked-jobs",
]);

function proposalHref(proposal: HomeProposal): string {
  const status = normalizeProposalStatus(proposal.status);

  if (isProposalStatus(status) && status === "draft") {
    return `/proposals/${proposal.id}/edit`;
  }

  return `/proposals/${proposal.id}`;
}

function formatScheduleLabel(proposal: HomeProposal): string | undefined {
  if (proposal.planned_start_date_text?.trim()) {
    return proposal.planned_start_date_text.trim();
  }

  if (!proposal.planned_start_date) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(proposal.planned_start_date));
}

function buildCard(
  proposal: HomeProposal,
  options: {
    jobTitle?: string;
    status: HomeCard["status"];
    attentionNote?: string;
    timeLabel?: string;
  }
): HomeCard {
  const address = proposal.job_address?.trim();

  return {
    id: proposal.id,
    href: proposalHref(proposal),
    proposalNumber: proposal.proposal_number,
    proposalStatus: normalizeProposalStatus(proposal.status),
    customer: proposal.customer_name ?? "Customer",
    jobTitle: options.jobTitle ?? proposal.title,
    timeLabel: options.timeLabel,
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
  return proposals.filter((proposal) => {
    const status = normalizeProposalStatus(proposal.status);

    return (
      isActiveHomeProposal(status) &&
      (status === "needs_attention" || status === "waiting_for_customer")
    );
  }).length;
}

export function buildHomeSections(proposals: HomeProposal[]): HomeSection[] {
  const activeProposals = proposals.filter((proposal) =>
    isActiveHomeProposal(normalizeProposalStatus(proposal.status))
  );

  const todaysJobCards = activeProposals
    .filter((proposal) =>
      isConfirmedBooking(proposal.status, proposal.booking_confirmation) &&
      isPlannedStartToday(proposal.planned_start_date)
    )
    .slice(0, 8)
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Today", tone: "green" },
        timeLabel: formatScheduleLabel(proposal),
        attentionNote: "Confirmed booking for today",
      })
    );

  const jobsNeedingAttention = activeProposals
    .filter(
      (proposal) =>
        normalizeProposalStatus(proposal.status) === "needs_attention"
    )
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Respond", tone: "orange" },
        attentionNote: formatAttentionReason(proposal.attention_reason),
      })
    );

  const waitingForCustomer = activeProposals
    .filter(
      (proposal) =>
        normalizeProposalStatus(proposal.status) === "waiting_for_customer"
    )
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Waiting", tone: "orange" },
        attentionNote: "Awaiting customer action",
        timeLabel: proposal.sent_at
          ? new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
            }).format(new Date(proposal.sent_at))
          : undefined,
      })
    );

  const quotesToFinish = activeProposals
    .filter(
      (proposal) => normalizeProposalStatus(proposal.status) === "draft"
    )
    .slice(0, 8)
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Draft", tone: "blue" },
        attentionNote: "Finish and save this quote",
      })
    );

  const quotesReadyToSend = activeProposals
    .filter(
      (proposal) =>
        normalizeProposalStatus(proposal.status) === "ready_to_send"
    )
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: { label: "Ready", tone: "purple" },
        attentionNote: "Send by email",
      })
    );

  const bookedJobs = activeProposals
    .filter((proposal) => {
      const status = normalizeProposalStatus(proposal.status);

      return (
        status === "booked" &&
        (isConfirmedBooking(status, proposal.booking_confirmation) ||
          isProvisionalBooking(status, proposal.booking_confirmation)) &&
        isPlannedStartInFuture(proposal.planned_start_date)
      );
    })
    .slice(0, 8)
    .map((proposal) =>
      buildCard(proposal, {
        jobTitle: getProposalSummaryLabel(proposal),
        status: {
          label: isProvisionalBooking(
            proposal.status,
            proposal.booking_confirmation
          )
            ? "Provisional"
            : "Booked",
          tone: "green",
        },
        timeLabel: formatScheduleLabel(proposal),
        attentionNote: isProvisionalBooking(
          proposal.status,
          proposal.booking_confirmation
        )
          ? "Confirm this booking"
          : "Confirmed on your calendar",
      })
    );

  const cancelledJobs = proposals
    .filter(
      (proposal) => normalizeProposalStatus(proposal.status) === "cancelled"
    )
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
      viewAllHref: "/calendar",
      cards: todaysJobCards,
      emptyMessage: "No confirmed jobs for today.",
    },
    {
      id: "jobs-needing-attention",
      title: "Jobs Needing Attention",
      tone: "orange",
      viewAllHref: "/proposals",
      cards: jobsNeedingAttention,
      emptyMessage: "Nothing needs your response right now.",
    },
    {
      id: "waiting-for-customer",
      title: "Waiting for Customer",
      tone: "orange",
      viewAllHref: "/proposals",
      cards: waitingForCustomer,
      emptyMessage: "No quotes awaiting customer action.",
    },
    {
      id: "quotes-to-finish",
      title: "Quotes to Finish",
      tone: "blue",
      viewAllHref: "/proposals",
      cards: quotesToFinish,
      emptyMessage: "No quotes to finish.",
    },
    {
      id: "quotes-ready-to-send",
      title: "Quotes Ready to Send",
      tone: "purple",
      viewAllHref: "/proposals",
      cards: quotesReadyToSend,
      emptyMessage: "No quotes waiting to send.",
    },
    {
      id: "booked-jobs",
      title: "Booked Jobs",
      tone: "green",
      viewAllHref: "/calendar",
      cards: bookedJobs,
      emptyMessage: "No upcoming booked jobs.",
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
