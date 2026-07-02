import type { ReactNode } from "react";
import {
  buildProposalTimeline,
  formatTimelineTimestamp,
  type TimelineEvent,
} from "@/lib/proposals/timeline";

const EVENT_ICONS: Record<TimelineEvent["type"], ReactNode> = {
  created: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l2 2" />
    </svg>
  ),
  ai_draft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8H4l4.9 3.6-1.9 5.8L12 14.6l5 3.8-1.9-5.8L20 8.8h-6.1L12 3z" />
    </svg>
  ),
  edited: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  pdf: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  emailed: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  sent: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  viewed: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  accepted: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
};

export function ProposalTimeline({
  proposal,
  statusEvents = [],
}: {
  proposal: Parameters<typeof buildProposalTimeline>[0];
  statusEvents?: Parameters<typeof buildProposalTimeline>[1];
}) {
  const events = buildProposalTimeline(proposal, statusEvents);

  return (
    <ol className="qf-workspace-timeline">
      {events.map((event, index) => (
        <li key={event.id} className="qf-workspace-timeline-item">
          <span
            className={`qf-workspace-timeline-dot ${
              event.status === "pending"
                ? "qf-workspace-timeline-dot-pending"
                : "qf-workspace-timeline-dot-complete"
            }`}
            aria-hidden="true"
          >
            {EVENT_ICONS[event.type]}
          </span>
          {index < events.length - 1 ? (
            <span className="qf-workspace-timeline-line" aria-hidden="true" />
          ) : null}
          <div className="qf-workspace-timeline-content">
            <p className="qf-workspace-timeline-label">{event.label}</p>
            {event.description ? (
              <p className="qf-workspace-timeline-description">
                {event.description}
              </p>
            ) : null}
            {event.timestamp ? (
              <p className="qf-workspace-timeline-time">
                {formatTimelineTimestamp(event.timestamp)}
              </p>
            ) : event.status === "pending" ? (
              <p className="qf-workspace-timeline-time qf-workspace-timeline-pending">
                Pending
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
