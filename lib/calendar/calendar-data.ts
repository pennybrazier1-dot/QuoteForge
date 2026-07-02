import { getProposalSummaryLabel } from "@/lib/proposals/display";
import { isConfirmedBooking, isProvisionalBooking } from "@/lib/proposals/booking";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type CalendarView = "month" | "week" | "day" | "year";

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
  addressLine?: string;
  tone: CalendarEventTone;
  duration?: string;
};

export type CalendarMonthCell = {
  day: number | null;
  iso: string | null;
};

export type CalendarWeekDay = {
  iso: string;
  dayNumber: number;
  weekdayShort: string;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function isToday(iso: string, todayIso = toIsoDate(new Date())): boolean {
  return iso === todayIso;
}

export function isSameIsoDate(left: string, right: string): boolean {
  return left === right;
}

export function startOfWeek(date: Date): string {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);

  return toIsoDate(next);
}

export function endOfWeek(date: Date): string {
  const start = parseIsoDate(startOfWeek(date));
  start.setDate(start.getDate() + 6);

  return toIsoDate(start);
}

export function buildWeekDays(anchor: Date): CalendarWeekDay[] {
  const start = parseIsoDate(startOfWeek(anchor));
  const formatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index
    );

    return {
      iso: toIsoDate(day),
      dayNumber: day.getDate(),
      weekdayShort: formatter.format(day),
    };
  });
}

export function buildMonthCells(anchor: Date): CalendarMonthCell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarMonthCell[] = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ day: null, iso: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      iso: toIsoDate(new Date(year, month, day)),
    });
  }

  return cells;
}

export function getWeekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS;
}

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
        }).format(parseIsoDate(date));

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

export function getEventsForDate(
  events: CalendarEvent[],
  iso: string
): CalendarEvent[] {
  return events.filter((event) => event.date === iso);
}

export function getEventCountsByDate(
  events: CalendarEvent[]
): Map<string, { confirmed: number; provisional: number }> {
  const counts = new Map<string, { confirmed: number; provisional: number }>();

  for (const event of events) {
    const current = counts.get(event.date) ?? {
      confirmed: 0,
      provisional: 0,
    };
    current[event.tone] += 1;
    counts.set(event.date, current);
  }

  return counts;
}

export function filterEventsForView(
  events: CalendarEvent[],
  view: CalendarView,
  anchor: Date
): CalendarEvent[] {
  const anchorIso = toIsoDate(anchor);

  if (view === "day") {
    return events.filter((event) => event.date === anchorIso);
  }

  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);

    return events.filter((event) => event.date >= start && event.date <= end);
  }

  if (view === "month") {
    const monthPrefix = anchorIso.slice(0, 7);

    return events.filter((event) => event.date.startsWith(monthPrefix));
  }

  const year = String(anchor.getFullYear());

  return events.filter((event) => event.date.startsWith(year));
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
    const start = parseIsoDate(startOfWeek(anchor));
    const end = parseIsoDate(endOfWeek(anchor));
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

export function formatSelectedDayHeading(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseIsoDate(iso));
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

export function shiftSelectedDate(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);

  return toIsoDate(date);
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
