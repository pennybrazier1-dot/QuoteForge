import { formatJobStatus } from "@/lib/jobs/status";
import { formatProposalStatus } from "@/lib/proposals/status";
import { formatVisitType } from "@/lib/visits/types";

export const LAST_MINUTE_CANCELLATION_SUPPORTED = false;

export const CUSTOMER_DETAIL_SECTIONS = [
  {
    id: "details",
    title: "Customer details",
    defaultOpen: true,
  },
  {
    id: "current_work",
    title: "Current work",
    defaultOpen: true,
  },
  {
    id: "job_history",
    title: "Job history",
    defaultOpen: false,
  },
  {
    id: "proposals",
    title: "Proposals",
    defaultOpen: false,
  },
  {
    id: "visits",
    title: "Visits",
    defaultOpen: false,
  },
  {
    id: "activity",
    title: "Activity history",
    defaultOpen: false,
  },
] as const;

export type CustomerDetailSectionId =
  (typeof CUSTOMER_DETAIL_SECTIONS)[number]["id"];

const CURRENT_JOB_STATUSES = new Set<string>([
  "accepted",
  "preparing",
  "scheduled",
  "in_progress",
]);

const HISTORY_JOB_STATUSES = new Set<string>([
  "completed",
  "invoiced",
  "paid",
]);

export type CustomerDetailJob = {
  id: string;
  status: string;
  accepted_at: string | null;
  completed_at?: string | null;
  proposal_id: string | null;
};

export type CustomerDetailProposal = {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  total_amount: number;
  created_at: string;
};

export type CustomerDetailVisit = {
  id: string;
  visit_date: string | null;
  visit_time: string | null;
  status: string;
  visit_type: string | null;
};

export type CustomerActivityEvent = {
  id: string;
  proposalId?: string | null;
  eventType: string;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
};

export type CustomerActivityItem = {
  id: string;
  label: string;
  detail: string | null;
  timestamp: string;
  href?: string | null;
};

export function isCurrentCustomerJob(status: string): boolean {
  return CURRENT_JOB_STATUSES.has(status);
}

export function isHistoryCustomerJob(status: string): boolean {
  return HISTORY_JOB_STATUSES.has(status);
}

export function splitCustomerJobs(jobs: CustomerDetailJob[]): {
  current: CustomerDetailJob[];
  history: CustomerDetailJob[];
} {
  return {
    current: jobs.filter((job) => isCurrentCustomerJob(job.status)),
    history: jobs.filter((job) => isHistoryCustomerJob(job.status)),
  };
}

export function splitCustomerVisits(visits: CustomerDetailVisit[]): {
  current: CustomerDetailVisit[];
  history: CustomerDetailVisit[];
} {
  return {
    current: visits.filter(
      (visit) => visit.status === "scheduled" || visit.status === "confirmed"
    ),
    history: visits.filter(
      (visit) =>
        visit.status === "completed" ||
        visit.status === "cancelled" ||
        visit.status === "no_show"
    ),
  };
}

export function customerJobLabel(status: string): string {
  return formatJobStatus(status);
}

export function customerProposalLabel(status: string): string {
  return formatProposalStatus(status);
}

export function customerVisitLabel(visit: CustomerDetailVisit): string {
  return visit.visit_type ? formatVisitType(visit.visit_type) : "Visit";
}

export function isStoredCustomerActivityEvent(
  event: CustomerActivityEvent
): boolean {
  const toStatus = event.toStatus?.toLowerCase() ?? "";
  const type = event.eventType.toLowerCase();
  return (
    toStatus === "cancelled" ||
    toStatus === "declined" ||
    type === "rearranged" ||
    type === "cancelled" ||
    type === "customer_accepted"
  );
}

export function buildCustomerActivityItems(
  events: CustomerActivityEvent[]
): CustomerActivityItem[] {
  return events
    .filter((event) => isStoredCustomerActivityEvent(event))
    .map((event) => {
      const toStatus = event.toStatus?.toLowerCase();
      let label = event.note?.trim() || "Recorded activity";
      if (toStatus === "cancelled") {
        label = event.note?.trim() || "Proposal cancelled";
      } else if (toStatus === "declined") {
        label = event.note?.trim() || "Proposal declined";
      } else if (event.eventType === "rearranged") {
        label = event.note?.trim() || "Date changed";
      } else if (event.eventType === "customer_accepted") {
        label = event.note?.trim() || "Proposal accepted";
      }
      return {
        id: event.id,
        label,
        detail: event.toStatus ? customerProposalLabel(event.toStatus) : null,
        timestamp: event.createdAt,
        href: event.proposalId ? `/proposals/${event.proposalId}` : null,
      };
    })
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export function customerDetailSectionDefaultOpen(
  id: CustomerDetailSectionId
): boolean {
  return CUSTOMER_DETAIL_SECTIONS.find((section) => section.id === id)
    ?.defaultOpen ?? false;
}
