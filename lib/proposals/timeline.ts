import { hasStructuredProposal } from "@/lib/proposals/structured-proposal";

export type TimelineEventType =
  | "created"
  | "ai_draft"
  | "edited"
  | "pdf"
  | "sent"
  | "viewed"
  | "accepted";

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
  job_summary: string | null;
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
  proposal: TimelineProposal
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
    "sent",
    "accepted",
    "declined",
  ]);

  if (pdfReadyStatuses.has(proposal.status)) {
    events.push({
      id: "pdf",
      type: "pdf",
      label: "PDF generated",
      timestamp: proposal.sent_at ?? updatedAt ?? createdAt,
      status: "complete",
    });
  }

  if (proposal.sent_at) {
    events.push({
      id: "sent",
      type: "sent",
      label: "Sent",
      timestamp: proposal.sent_at,
      status: "complete",
    });

    if (proposal.status === "sent" && !proposal.accepted_at) {
      events.push({
        id: "viewed",
        type: "viewed",
        label: "Viewed",
        description: "Waiting for customer to open the proposal",
        timestamp: null,
        status: "pending",
      });
    }
  }

  if (proposal.accepted_at) {
    events.push({
      id: "accepted",
      type: "accepted",
      label: "Accepted",
      timestamp: proposal.accepted_at,
      status: "complete",
    });
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
