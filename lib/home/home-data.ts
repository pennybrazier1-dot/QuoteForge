import { getProposalSummaryLabel } from "@/lib/proposals/display";
import {
  classifyHomeProposal,
  classifyHomeVisit,
  visitHomeAddress,
  visitHomeNotes,
  type HomeProposalBucket,
} from "@/lib/home/home-lifecycle";
import {
  isActiveHomeProposal,
  isProposalStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";
import type { VisitRecord } from "@/lib/visits/types";

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
  planned_start_time?: string | null;
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
  detailLines?: string[];
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

export type HomeSectionGroup = {
  id: "today" | "needs-action" | "waiting" | "upcoming";
  title: string;
  sections: HomeSection[];
};

export const HOME_SWIPE_SECTION_IDS = new Set([
  "todays-jobs",
  "todays-initial-visits",
  "needs-attention",
  "quotes-to-finish",
  "quotes-ready-to-send",
  "jobs-to-schedule",
  "waiting-for-customer",
  "upcoming-initial-visits",
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

function buildProposalCard(
  proposal: HomeProposal,
  options: {
    jobTitle?: string;
    status: HomeCard["status"];
    attentionNote?: string;
    timeLabel?: string;
    detailLines?: string[];
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
    detailLines: options.detailLines,
    plannedStartDateText: proposal.planned_start_date_text,
    plannedStartDate: proposal.planned_start_date,
    estimatedDuration: proposal.estimated_duration,
  };
}

function buildVisitCard(
  visit: VisitRecord,
  status: HomeCard["status"]
): HomeCard {
  const notes = visitHomeNotes(visit);
  return {
    id: `visit-${visit.id}`,
    href: `/visits/${visit.id}`,
    proposalNumber: "",
    proposalStatus: "visit",
    customer: visit.customer_name.trim() || "Customer",
    jobTitle: notes[0] ?? "Initial visit",
    timeLabel: notes[1],
    addressLine: visitHomeAddress(visit),
    status,
    attentionNote: undefined,
    plannedStartDateText: notes[1] ?? null,
    plannedStartDate: visit.visit_date,
    estimatedDuration: null,
  };
}

function cardsForBucket(
  classified: ReturnType<typeof classifyHomeProposal>[],
  bucket: HomeProposalBucket,
  options: {
    status: HomeCard["status"];
    timeLabel?: (item: (typeof classified)[number]) => string | undefined;
    attentionNote?: (item: (typeof classified)[number]) => string | undefined;
    detailLines?: (item: (typeof classified)[number]) => string[] | undefined;
    limit?: number;
  }
): HomeCard[] {
  const cards = classified
    .filter((item) => item.bucket === bucket)
    .map((item) =>
      buildProposalCard(item.proposal as HomeProposal, {
        jobTitle: getProposalSummaryLabel(item.proposal as HomeProposal),
        status: options.status,
        timeLabel: options.timeLabel?.(item),
        attentionNote: options.attentionNote?.(item) ?? item.notes[0],
        detailLines: options.detailLines?.(item) ?? item.notes,
      })
    );
  return options.limit ? cards.slice(0, options.limit) : cards;
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
    const bucket = classifyHomeProposal(proposal).bucket;
    return (
      bucket === "needs_attention" ||
      bucket === "quotes_to_finish" ||
      bucket === "quotes_ready_to_send" ||
      bucket === "jobs_to_schedule"
    );
  }).length;
}

export function buildHomeSections(
  proposals: HomeProposal[],
  visits: VisitRecord[] = [],
  reference = new Date()
): HomeSection[] {
  return buildHomeSectionGroups(proposals, visits, reference).flatMap(
    (group) => group.sections
  );
}

export function buildHomeSectionGroups(
  proposals: HomeProposal[],
  visits: VisitRecord[] = [],
  reference = new Date()
): HomeSectionGroup[] {
  const classified = proposals
    .filter((proposal) =>
      isActiveHomeProposal(normalizeProposalStatus(proposal.status))
    )
    .map((proposal) => classifyHomeProposal(proposal, reference));

  const todayVisits = visits
    .filter((visit) => classifyHomeVisit(visit, reference) === "today_visit")
    .map((visit) =>
      buildVisitCard(visit, { label: "Visit", tone: "green" })
    );
  const upcomingVisits = visits
    .filter((visit) => classifyHomeVisit(visit, reference) === "upcoming_visit")
    .map((visit) =>
      buildVisitCard(visit, { label: "Visit", tone: "green" })
    );

  const todaysJobs = cardsForBucket(classified, "today_job", {
    status: { label: "Today", tone: "green" },
    timeLabel: (item) => item.slotLabel ?? formatScheduleLabel(item.proposal as HomeProposal),
    attentionNote: () => undefined,
    detailLines: (item) => item.notes,
    limit: 8,
  });
  const needsAttention = cardsForBucket(classified, "needs_attention", {
    status: { label: "Respond", tone: "orange" },
  });
  const quotesToFinish = cardsForBucket(classified, "quotes_to_finish", {
    status: { label: "Draft", tone: "blue" },
    limit: 8,
  });
  const quotesReady = cardsForBucket(classified, "quotes_ready_to_send", {
    status: { label: "Ready", tone: "purple" },
  });
  const jobsToSchedule = cardsForBucket(classified, "jobs_to_schedule", {
    status: { label: "Schedule", tone: "orange" },
    timeLabel: (item) => formatScheduleLabel(item.proposal as HomeProposal),
  });
  const waiting = cardsForBucket(classified, "waiting_for_customers", {
    status: { label: "Waiting", tone: "orange" },
    timeLabel: (item) =>
      item.slotLabel ??
      ((item.proposal as HomeProposal).sent_at
        ? new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
          }).format(new Date((item.proposal as HomeProposal).sent_at as string))
        : undefined),
    attentionNote: (item) => item.notes[0],
    detailLines: (item) => item.notes,
  });
  const bookedJobs = cardsForBucket(classified, "booked_job", {
    status: { label: "Booked", tone: "green" },
    timeLabel: (item) => item.slotLabel ?? formatScheduleLabel(item.proposal as HomeProposal),
    attentionNote: () => undefined,
    detailLines: (item) => item.notes,
    limit: 8,
  });

  return [
    {
      id: "today",
      title: "Today",
      sections: [
        {
          id: "todays-jobs",
          title: "Today's jobs",
          tone: "green",
          viewAllHref: "/calendar",
          cards: todaysJobs,
          emptyMessage: "No jobs booked for today.",
        },
        {
          id: "todays-initial-visits",
          title: "Today's initial visits",
          tone: "green",
          viewAllHref: "/visits",
          cards: todayVisits,
          emptyMessage: "No initial visits today.",
        },
      ],
    },
    {
      id: "needs-action",
      title: "Needs action",
      sections: [
        {
          id: "needs-attention",
          title: "Needs attention",
          tone: "orange",
          viewAllHref: "/proposals",
          cards: needsAttention,
          emptyMessage: "Nothing needs your response right now.",
        },
        {
          id: "quotes-to-finish",
          title: "Quotes to finish",
          tone: "blue",
          viewAllHref: "/proposals",
          cards: quotesToFinish,
          emptyMessage: "No quotes to finish.",
        },
        {
          id: "quotes-ready-to-send",
          title: "Quotes ready to send",
          tone: "purple",
          viewAllHref: "/proposals",
          cards: quotesReady,
          emptyMessage: "No quotes waiting to send.",
        },
        {
          id: "jobs-to-schedule",
          title: "Jobs to schedule",
          tone: "orange",
          viewAllHref: "/proposals",
          cards: jobsToSchedule,
          emptyMessage: "No jobs waiting to be scheduled.",
        },
      ],
    },
    {
      id: "waiting",
      title: "Waiting",
      sections: [
        {
          id: "waiting-for-customer",
          title: "Waiting for customers",
          tone: "orange",
          viewAllHref: "/proposals",
          cards: waiting,
          emptyMessage: "No proposals waiting on the customer.",
        },
      ],
    },
    {
      id: "upcoming",
      title: "Upcoming",
      sections: [
        {
          id: "upcoming-initial-visits",
          title: "Upcoming initial visits",
          tone: "green",
          viewAllHref: "/visits",
          cards: upcomingVisits,
          emptyMessage: "No upcoming initial visits.",
        },
        {
          id: "booked-jobs",
          title: "Booked jobs",
          tone: "green",
          viewAllHref: "/calendar",
          cards: bookedJobs,
          emptyMessage: "No upcoming booked jobs.",
        },
      ],
    },
  ];
}
