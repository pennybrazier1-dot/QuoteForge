import { formatAttentionReason } from "@/lib/proposals/attention";
import { buildDateWorkflowSnapshot } from "@/lib/proposals/date-workflow";
import {
  isPlannedStartInFuture,
  isPlannedStartToday,
} from "@/lib/proposals/lifecycle";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import {
  formatVisitAddress,
  formatVisitDateLabel,
  formatVisitTimeLabel,
  formatVisitType,
  type VisitRecord,
} from "@/lib/visits/types";

export type HomeLifecycleProposal = {
  id: string;
  status: string;
  attention_reason: string | null;
  booking_confirmation: string | null;
  accepted_at: string | null;
  planned_start_date_text: string | null;
  planned_start_date: string | null;
  planned_start_time?: string | null;
};

export type HomeProposalBucket =
  | "today_job"
  | "needs_attention"
  | "quotes_to_finish"
  | "quotes_ready_to_send"
  | "jobs_to_schedule"
  | "waiting_for_customers"
  | "booked_job"
  | "none";

export type HomeVisitBucket = "today_visit" | "upcoming_visit" | "none";

export type ClassifiedHomeProposal = {
  proposal: HomeLifecycleProposal;
  bucket: HomeProposalBucket;
  snapshot: ReturnType<typeof buildDateWorkflowSnapshot>;
  slotLabel: string | null;
  notes: string[];
};

const DATE_ONLY_ATTENTION = new Set(["customer_requested_date_change"]);

export function formatHomeSlotLabel(input: {
  dateIso?: string | null;
  dateText?: string | null;
  timeHm?: string | null;
}): string | null {
  if (input.dateIso?.trim()) {
    const [year, month, day] = input.dateIso.split("-").map(Number);
    const datePart = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
    }).format(new Date(year, month - 1, day));
    return input.timeHm?.trim()
      ? `${datePart} · ${input.timeHm.trim()}`
      : datePart;
  }
  return input.dateText?.trim() || null;
}

export function isDateOnlyAttentionResolved(
  attentionReason: string | null | undefined,
  dateState: "none" | "provisional" | "confirmed"
): boolean {
  if (dateState !== "confirmed" && dateState !== "provisional") {
    return false;
  }
  return !attentionReason || DATE_ONLY_ATTENTION.has(attentionReason);
}

export function hasUnresolvedHomeAttention(
  proposal: HomeLifecycleProposal
): boolean {
  const status = normalizeProposalStatus(proposal.status);
  const snapshot = buildDateWorkflowSnapshot({
    status: proposal.status,
    acceptedAt: proposal.accepted_at,
    bookingConfirmation: proposal.booking_confirmation,
    plannedStartDate: proposal.planned_start_date,
    plannedStartTime: proposal.planned_start_time,
  });

  if (snapshot.isBookedJob) {
    return false;
  }
  if (status !== "needs_attention") {
    return false;
  }
  if (isDateOnlyAttentionResolved(proposal.attention_reason, snapshot.dateState)) {
    return false;
  }
  return true;
}

export function classifyHomeProposal(
  proposal: HomeLifecycleProposal,
  reference = new Date()
): ClassifiedHomeProposal {
  const snapshot = buildDateWorkflowSnapshot({
    status: proposal.status,
    acceptedAt: proposal.accepted_at,
    bookingConfirmation: proposal.booking_confirmation,
    plannedStartDate: proposal.planned_start_date,
    plannedStartTime: proposal.planned_start_time,
  });
  const status = normalizeProposalStatus(proposal.status);
  const slotLabel = formatHomeSlotLabel({
    dateIso: proposal.planned_start_date,
    dateText: proposal.planned_start_date_text,
    timeHm: proposal.planned_start_time,
  });

  if (snapshot.isBookedJob) {
    const today = isPlannedStartToday(proposal.planned_start_date, reference);
    return {
      proposal,
      snapshot,
      slotLabel,
      bucket: today ? "today_job" : "booked_job",
      notes: today
        ? ["Today's job"]
        : isPlannedStartInFuture(proposal.planned_start_date, reference)
          ? ["Booked job"]
          : ["Booked job"],
    };
  }

  if (snapshot.proposalAccepted && snapshot.dateState === "none") {
    return {
      proposal,
      snapshot,
      slotLabel,
      bucket: "jobs_to_schedule",
      notes: ["Schedule job"],
    };
  }

  if (hasUnresolvedHomeAttention(proposal)) {
    return {
      proposal,
      snapshot,
      slotLabel,
      bucket: "needs_attention",
      notes: [formatAttentionReason(proposal.attention_reason)],
    };
  }

  if (status === "draft") {
    return {
      proposal,
      snapshot,
      slotLabel,
      bucket: "quotes_to_finish",
      notes: ["Finish this quote"],
    };
  }

  if (status === "ready_to_send") {
    return {
      proposal,
      snapshot,
      slotLabel,
      bucket: "quotes_ready_to_send",
      notes: ["Send to customer"],
    };
  }

  if (
    status === "waiting_for_customer" ||
    snapshot.waitingForProposalAcceptance ||
    snapshot.waitingForDateConfirmation
  ) {
    const notes: string[] = [];
    if (snapshot.waitingForProposalAcceptance && slotLabel) {
      notes.push(`Date confirmed: ${slotLabel}`);
      notes.push("Waiting for proposal acceptance");
    } else if (snapshot.waitingForDateConfirmation && slotLabel) {
      notes.push(`Date held: ${slotLabel}`);
      notes.push("Waiting for customer to confirm date");
    } else {
      notes.push("Waiting for customer");
    }
    return {
      proposal,
      snapshot,
      slotLabel,
      bucket: "waiting_for_customers",
      notes,
    };
  }

  return {
    proposal,
    snapshot,
    slotLabel,
    bucket: "none",
    notes: [],
  };
}

export function isOpenInitialVisit(visit: VisitRecord): boolean {
  const initialType =
    visit.visit_type === "initial_assessment" || visit.visit_type === "measure_up";
  const open =
    visit.status === "scheduled" || visit.status === "confirmed";
  return initialType && open;
}

export function classifyHomeVisit(
  visit: VisitRecord,
  reference = new Date()
): HomeVisitBucket {
  if (!isOpenInitialVisit(visit)) {
    return "none";
  }
  if (isPlannedStartToday(visit.visit_date, reference)) {
    return "today_visit";
  }
  if (isPlannedStartInFuture(visit.visit_date, reference)) {
    return "upcoming_visit";
  }
  return "none";
}

export function visitHomeNotes(visit: VisitRecord): string[] {
  const time = formatVisitTimeLabel(visit.visit_time);
  const when = [formatVisitDateLabel(visit.visit_date), time]
    .filter(Boolean)
    .join(" · ");
  return [formatVisitType(visit.visit_type), when].filter(Boolean);
}

export function visitHomeAddress(visit: VisitRecord): string | undefined {
  return formatVisitAddress(visit) || undefined;
}
