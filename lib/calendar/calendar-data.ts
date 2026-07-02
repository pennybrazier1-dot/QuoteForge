import { getProposalSummaryLabel } from "@/lib/proposals/display";
import { isConfirmedBooking, isProvisionalBooking } from "@/lib/proposals/booking";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type CalendarView = "day" | "week" | "month" | "year";

export type CalendarEventTone = "confirmed" | "provisional";

export type CalendarProposal = {
  id: string;
  proposal_number: string;
  customer_name: string | null;
  title: string;
  job_summary: string | null;
  rough_notes: string | null;
  status: string;
  booking_confirmation: string | null;
  planned_start_date: string | null;
  planned_start_date_text: string | null;
  estimated_duration: string | null;
  job_address: string | null;
};

export type CalendarEvent = {
  id: string;
  proposalId: string;
  href: string;
  title: string;
  customer: string;
  date: string;
  dateLabel: string;
  timeLabel?: string;
  addressLine?: string;
  tone: CalendarEventTone;
  duration?: string;
};

export function getCalendarEventDate(proposal: CalendarProposal): string | null {
  if (proposal.planned_start_date) {
    return proposal.planned_start_date.slice(0, 10);
  }

  return null;
}

export function buildCalendarEvents(
  proposals: CalendarProposal[]
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const proposal of proposals) {
    const status = normalizeProposalStatus(proposal.status);
    const date = getCalendarEventDate(proposal);

    if (status !== "booked" || !date) {
      continue;
    }

    const tone = isConfirmedBooking(status, proposal.booking_confirmation)
      ? "confirmed"
      : isProvisionalBooking(status, proposal.booking_confirmation)
        ? "provisional"
        : null;

    if (!tone) {
      continue;
    }

    const dateLabel = proposal.planned_start_date_text?.trim()
      ? proposal.planned_start_date_text.trim()
      : new Intl.DateTimeFormat("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(new Date(date));

    events.push({
      id: `${proposal.id}-${date}`,
      proposalId: proposal.id,
      href: `/proposals/${proposal.id}`,
      title: getProposalSummaryLabel(proposal),
      customer: proposal.customer_name ?? "Customer",
      date,
      dateLabel,
      addressLine: proposal.job_address?.trim() || undefined,
      tone,
      duration: proposal.estimated_duration?.trim() || undefined,
    });
  }

  return events.sort((left, right) => left.date.localeCompare(right.date));
}

export function filterEventsForView(
  events: CalendarEvent[],
  view: CalendarView,
  anchor: Date
): CalendarEvent[] {
  const anchorIso = anchor.toISOString().slice(0, 10);

  if (view === "day") {
    return events.filter((event) => event.date === anchorIso);
  }

  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);

    return events.filter(
      (event) => event.date >= start && event.date <= end
    );
  }

  if (view === "month") {
    const monthPrefix = anchorIso.slice(0, 7);

    return events.filter((event) => event.date.startsWith(monthPrefix));
  }

  const year = String(anchor.getFullYear());

  return events.filter((event) => event.date.startsWith(year));
}

function startOfWeek(date: Date): string {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

function endOfWeek(date: Date): string {
  const start = new Date(startOfWeek(date));
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}

export function formatCalendarHeading(view: CalendarView, anchor: Date): string {
  if (view === "day") {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(anchor);
  }

  if (view === "week") {
    const start = new Date(startOfWeek(anchor));
    const end = new Date(endOfWeek(anchor));
    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    });

    return `${formatter.format(start)} – ${formatter.format(end)} ${anchor.getFullYear()}`;
  }

  if (view === "month") {
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(anchor);
  }

  return String(anchor.getFullYear());
}

export function shiftAnchor(
  view: CalendarView,
  anchor: Date,
  direction: -1 | 1
): Date {
  const next = new Date(anchor);

  if (view === "day") {
    next.setDate(next.getDate() + direction);
    return next;
  }

  if (view === "week") {
    next.setDate(next.getDate() + direction * 7);
    return next;
  }

  if (view === "month") {
    next.setMonth(next.getMonth() + direction);
    return next;
  }

  next.setFullYear(next.getFullYear() + direction);
  return next;
}

export function groupEventsByDate(
  events: CalendarEvent[]
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const existing = groups.get(event.date) ?? [];
    existing.push(event);
    groups.set(event.date, existing);
  }

  return groups;
}
