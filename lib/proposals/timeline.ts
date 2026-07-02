import {
  getSenderNameFromEventMetadata,
  type ProposalStatusEventRecord,
} from "@/lib/proposals/proposal-status-events";
import { hasStructuredProposal } from "@/lib/proposals/structured-proposal";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type TimelineEventType =
  | "created"
  | "ai_draft"
  | "edited"
  | "pdf"
  | "emailed"
  | "waiting_for_customer"
  | "viewed"
  | "customer_accepted"
  | "needs_attention"
  | "booked"
  | "completed"
  | "cancelled"
  | "rearranged";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  label: string;
  description?: string;
  timestamp: string | null;
  status: "complete" | "pending";
};

export type TimelineProposal = {
  status: string;
  created_at: string;
  updated_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  booked_at?: string | null;
  completed_at?: string | null;
  job_summary: string | null;
  booking_confirmation?: string | null;
};

const MINUTE_MS = 60_000;

function parseTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatTimelineDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTimelineTimestamp(
  timestamp: string | null
): string | null {
  if (!timestamp) {
    return null;
  }

  return formatTimelineDate(timestamp);
}

export function buildProposalTimeline(
  proposal: TimelineProposal,
  statusEvents: ProposalStatusEventRecord[] = []
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const createdAt = proposal.created_at;
  const updatedAt = proposal.updated_at;
  const createdTime = parseTime(createdAt);
  const updatedTime = parseTime(updatedAt);
  const hasStructured = hasStructuredProposal(proposal);
  const wasEdited =
    createdTime !== null &&
    updatedTime !== null &&
    updatedTime - createdTime > MINUTE_MS;

  events.push({
    id: "created",
    type: "created",
    label: "Proposal created",
    timestamp: createdAt,
    status: "complete",
  });

  if (hasStructured) {
    const aiTimestamp =
      wasEdited && updatedAt ? updatedAt : createdAt;

    events.push({
      id: "ai_draft",
      type: "ai_draft",
      label: "AI draft generated",
      timestamp: aiTimestamp,
      status: "complete",
    });
  }

  if (wasEdited && updatedAt) {
    events.push({
      id: "edited",
      type: "edited",
      label: "Edited",
      timestamp: updatedAt,
      status: "complete",
    });
  }

  const pdfReadyStatuses = new Set([
    "ready_to_send",
    "waiting_for_customer",
    "needs_attention",
    "booked",
    "completed",
    "declined",
  ]);

  const normalizedStatus = normalizeProposalStatus(proposal.status);

  if (pdfReadyStatuses.has(normalizedStatus)) {
    events.push({
      id: "pdf",
      type: "pdf",
      label: "PDF generated",
      timestamp: proposal.sent_at ?? updatedAt ?? createdAt,
      status: "complete",
    });
  }

  const emailedEvents = statusEvents.filter(
    (event) => event.event_type === "emailed"
  );

  for (const event of emailedEvents) {
    const senderName = getSenderNameFromEventMetadata(event.metadata);

    events.push({
      id: event.id,
      type: "emailed",
      label: event.note ?? "Proposal emailed",
      description: senderName ? `Sent by ${senderName}` : undefined,
      timestamp: event.created_at,
      status: "complete",
    });
  }

  if (proposal.sent_at && emailedEvents.length === 0) {
    events.push({
      id: "waiting_for_customer",
      type: "waiting_for_customer",
      label: "Waiting for Customer",
      timestamp: proposal.sent_at,
      status: "complete",
    });

    if (
      normalizedStatus === "waiting_for_customer" &&
      !proposal.accepted_at
    ) {
      events.push({
        id: "viewed",
        type: "viewed",
        label: "Customer reply",
        description: "Waiting for the customer to accept the quote",
        timestamp: null,
        status: "pending",
      });
    }
  } else if (
    normalizedStatus === "waiting_for_customer" &&
    !proposal.accepted_at &&
    proposal.sent_at
  ) {
    events.push({
      id: "viewed",
      type: "viewed",
      label: "Viewed",
      description: "Waiting for customer to open the proposal",
      timestamp: null,
      status: "pending",
    });
  }

  if (proposal.accepted_at) {
    events.push({
      id: "customer_accepted",
      type: "customer_accepted",
      label: "Customer accepted",
      description:
        proposal.booking_confirmation === "confirmed"
          ? "Booking confirmed"
          : "Provisional booking — confirm the start date",
      timestamp: proposal.accepted_at,
      status: "complete",
    });
  }

  if (proposal.booked_at) {
    const isConfirmed = proposal.booking_confirmation === "confirmed";

    events.push({
      id: "booked",
      type: "booked",
      label: isConfirmed ? "Booking confirmed" : "Provisional booking",
      timestamp: proposal.booked_at,
      status: "complete",
    });
  }

  if (proposal.completed_at) {
    events.push({
      id: "completed",
      type: "completed",
      label: "Completed",
      timestamp: proposal.completed_at,
      status: "complete",
    });
  }

  for (const event of statusEvents) {
    if (
      event.event_type === "status_change" &&
      event.to_status === "needs_attention"
    ) {
      events.push({
        id: event.id,
        type: "needs_attention",
        label: event.note ?? "Needs your attention",
        timestamp: event.created_at,
        status: "complete",
      });
    }

    if (event.event_type === "status_change" && event.to_status === "cancelled") {
      events.push({
        id: event.id,
        type: "cancelled",
        label: event.note ?? "Cancelled",
        timestamp: event.created_at,
        status: "complete",
      });
    }

    if (event.event_type === "rearranged") {
      events.push({
        id: event.id,
        type: "rearranged",
        label: event.note ?? "Date changed",
        timestamp: event.created_at,
        status: "complete",
      });
    }
  }

  if (normalizedStatus === "cancelled") {
    const hasCancelledEvent = events.some((event) => event.type === "cancelled");

    if (!hasCancelledEvent) {
      events.push({
        id: "cancelled",
        type: "cancelled",
        label: "Cancelled",
        timestamp: proposal.updated_at ?? proposal.created_at,
        status: "complete",
      });
    }
  }

  return events.sort((left, right) => {
    if (left.status === "pending" && right.status !== "pending") {
      return 1;
    }

    if (right.status === "pending" && left.status !== "pending") {
      return -1;
    }

    const leftTime = parseTime(left.timestamp) ?? 0;
    const rightTime = parseTime(right.timestamp) ?? 0;

    return leftTime - rightTime;
  });
}
