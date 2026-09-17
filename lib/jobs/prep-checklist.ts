import {
  JOB_PREP_ITEM_DEFINITIONS,
  formatJobPrepItemStatus,
  isPrepItemResolved,
  type JobPrepItemKey,
  type JobPrepItemStatus,
} from "@/lib/jobs/prep-items";
import { formatSlotLabel } from "@/lib/proposals/revision/conversation-agreements";
import {
  DEFAULT_NEW_VISIT_TYPE,
  type NewVisitType,
} from "@/lib/visits/new-visit";
import type { VisitRecord, VisitStatus, VisitType } from "@/lib/visits/types";

export const BOOKED_JOB_PREP_KEYS = [
  "customer_details",
  "measurements",
  "materials",
  "access_requirements",
  "site_visit",
] as const;

export type BookedJobPrepKey = (typeof BOOKED_JOB_PREP_KEYS)[number];

export type PrepChecklistTone = "done" | "open" | "skip";

export type PrepChecklistRow = {
  key: BookedJobPrepKey;
  itemId: string;
  label: string;
  status: JobPrepItemStatus;
  tone: PrepChecklistTone;
  statusLabel: string;
  detail: string | null;
  showMoreMenu: boolean;
};

export type LinkedVisitSummary = {
  id: string;
  visitType: VisitType;
  status: VisitStatus;
  slotLabel: string | null;
};

export function isActiveVisitStatus(status: string): boolean {
  return status !== "cancelled";
}

export function isInitialVisitType(type: string): boolean {
  return type === "initial_assessment" || type === "measure_up";
}

export function visitBelongsToJob(
  visit: Pick<VisitRecord, "linked_proposal_id" | "enquiry_id" | "customer_id">,
  context: {
    proposalId: string;
    enquiryId: string | null;
    customerId: string | null;
  }
): boolean {
  if (visit.linked_proposal_id === context.proposalId) {
    return true;
  }
  if (context.enquiryId && visit.enquiry_id === context.enquiryId) {
    return true;
  }
  return Boolean(
    context.customerId &&
      visit.customer_id === context.customerId &&
      !visit.linked_proposal_id
  );
}

export function defaultVisitTypeFromHistory(
  visits: Array<Pick<VisitRecord, "visit_type" | "status">>
): NewVisitType {
  const hasInitial = visits.some(
    (visit) =>
      isActiveVisitStatus(visit.status) && isInitialVisitType(visit.visit_type)
  );
  return hasInitial ? "follow_up" : DEFAULT_NEW_VISIT_TYPE;
}

export function pickRelevantVisit(
  visits: VisitRecord[],
  referenceDate = new Date()
): VisitRecord | null {
  const active = visits.filter((visit) => isActiveVisitStatus(visit.status));
  if (active.length === 0) {
    return null;
  }

  const today = referenceDate.toISOString().slice(0, 10);
  const upcoming = active
    .filter((visit) => visit.visit_date >= today)
    .sort((left, right) => left.visit_date.localeCompare(right.visit_date));
  if (upcoming[0]) {
    return upcoming[0];
  }

  return [...active].sort((left, right) =>
    right.visit_date.localeCompare(left.visit_date)
  )[0] ?? null;
}

export function buildBookVisitHref(input: {
  proposalId: string;
  customerId: string | null;
  enquiryId: string | null;
  visitType: NewVisitType;
}): string {
  const params = new URLSearchParams();
  params.set("proposalId", input.proposalId);
  if (input.customerId) {
    params.set("customerId", input.customerId);
  }
  if (input.enquiryId) {
    params.set("enquiryId", input.enquiryId);
  }
  params.set("visitType", input.visitType);
  return `/visits/new?${params.toString()}`;
}

function storedTone(status: JobPrepItemStatus): PrepChecklistTone {
  if (status === "confirmed") {
    return "done";
  }
  if (status === "not_needed") {
    return "skip";
  }
  return "open";
}

function openStatusLabel(key: BookedJobPrepKey): string {
  if (key === "measurements") {
    return "Needs confirming";
  }
  if (key === "site_visit") {
    return "Not booked";
  }
  return "Needs confirming";
}

export function buildPrepChecklistRows(input: {
  items: Array<{
    id: string;
    item_key: JobPrepItemKey;
    status: JobPrepItemStatus;
  }>;
  linkedVisit: VisitRecord | null;
}): PrepChecklistRow[] {
  const byKey = new Map(input.items.map((item) => [item.item_key, item]));

  return BOOKED_JOB_PREP_KEYS.map((key) => {
    const definition = JOB_PREP_ITEM_DEFINITIONS.find((item) => item.key === key);
    const stored = byKey.get(key);
    const status = stored?.status ?? "open";

    if (key === "site_visit" && input.linkedVisit && status !== "not_needed") {
      return {
        key,
        itemId: stored?.id ?? "",
        label: definition?.label ?? "Site visit",
        status,
        tone: "done",
        statusLabel: "Booked",
        detail: formatSlotLabel({
          dateIso: input.linkedVisit.visit_date,
          timeHm: input.linkedVisit.visit_time,
        }) || null,
        showMoreMenu: false,
      };
    }

    return {
      key,
      itemId: stored?.id ?? "",
      label: definition?.label ?? key,
      status,
      tone: storedTone(status),
      statusLabel:
        status === "open"
          ? openStatusLabel(key)
          : status === "not_needed"
            ? "Not needed"
            : "Confirmed",
      detail: null,
      showMoreMenu: Boolean(stored?.id) && !isPrepItemResolved(status),
    };
  });
}

export function summarizeLinkedVisit(
  visit: VisitRecord | null
): LinkedVisitSummary | null {
  if (!visit) {
    return null;
  }
  return {
    id: visit.id,
    visitType: visit.visit_type,
    status: visit.status,
    slotLabel:
      formatSlotLabel({
        dateIso: visit.visit_date,
        timeHm: visit.visit_time,
      }) || null,
  };
}

/** Kept so existing callers still have a readable stored-status label. */
export { formatJobPrepItemStatus };
