import { getProposalSummaryLabel } from "@/lib/proposals/display";
import { isConfirmedBooking, isProvisionalBooking } from "@/lib/proposals/booking";
import { parseEstimatedDuration } from "@/lib/proposals/duration";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import {
  expandJobSpanDates,
  parseDurationToCalendarDays,
} from "@/lib/calendar/job-span";

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
  things_to_confirm?: string | null;
  job_address: string | null;
};

/** One booked job on the calendar (deduplicated by proposal). */
export type CalendarJob = {
  id: string;
  proposalId: string;
  href: string;
  title: string;
  customer: string;
  startDate: string;
  endDate: string;
  spanDates: string[];
  dateLabel: string;
  tone: CalendarEventTone;
  duration?: string;
  addressLine?: string;
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

export function getCalendarStartDate(proposal: CalendarProposal): string | null {
  if (proposal.planned_start_date) {
    return proposal.planned_start_date.slice(0, 10);
  }

  return null;
}

export function buildCalendarJobs(
  proposals: CalendarProposal[]
): CalendarJob[] {
  const jobs: CalendarJob[] = [];

  for (const proposal of proposals) {
    const status = normalizeProposalStatus(proposal.status);
    const startDate = getCalendarStartDate(proposal);

    if (status !== "booked" || !startDate) {
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

    const durationText = parseEstimatedDuration(
      proposal.estimated_duration,
      proposal.things_to_confirm ?? null
    );
    const spanDayCount = parseDurationToCalendarDays(durationText);
    const spanDates = expandJobSpanDates(startDate, spanDayCount);

    const dateLabel = proposal.planned_start_date_text?.trim()
      ? proposal.planned_start_date_text.trim()
      : new Intl.DateTimeFormat("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(parseIsoDate(startDate));

    jobs.push({
      id: proposal.id,
      proposalId: proposal.id,
      href: `/proposals/${proposal.id}`,
      title: getProposalSummaryLabel(proposal),
      customer: proposal.customer_name ?? "Customer",
      startDate,
      endDate: spanDates[spanDates.length - 1] ?? startDate,
      spanDates,
      dateLabel,
      tone,
      duration: durationText || undefined,
      addressLine: proposal.job_address?.trim() || undefined,
    });
  }

  return jobs.sort((left, right) => left.startDate.localeCompare(right.startDate));
}

export function jobCoversDate(job: CalendarJob, iso: string): boolean {
  return job.spanDates.includes(iso);
}

export function getJobsForDate(
  jobs: CalendarJob[],
  iso: string
): CalendarJob[] {
  return jobs.filter((job) => jobCoversDate(job, iso));
}

export function getJobCountsByDate(
  jobs: CalendarJob[]
): Map<string, { confirmed: number; provisional: number }> {
  const counts = new Map<string, { confirmed: number; provisional: number }>();

  for (const job of jobs) {
    for (const date of job.spanDates) {
      const current = counts.get(date) ?? {
        confirmed: 0,
        provisional: 0,
      };
      current[job.tone] += 1;
      counts.set(date, current);
    }
  }

  return counts;
}

export function filterJobsForView(
  jobs: CalendarJob[],
  view: CalendarView,
  anchor: Date
): CalendarJob[] {
  const anchorIso = toIsoDate(anchor);

  if (view === "day") {
    return getJobsForDate(jobs, anchorIso);
  }

  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);

    return jobs.filter((job) =>
      job.spanDates.some((date) => date >= start && date <= end)
    );
  }

  if (view === "month") {
    const monthPrefix = anchorIso.slice(0, 7);

    return jobs.filter((job) =>
      job.spanDates.some((date) => date.startsWith(monthPrefix))
    );
  }

  const year = String(anchor.getFullYear());

  return jobs.filter((job) =>
    job.spanDates.some((date) => date.startsWith(year))
  );
}

export function getJobsForMonth(
  jobs: CalendarJob[],
  year: number,
  monthIndex: number
): CalendarJob[] {
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return jobs.filter((job) =>
    job.spanDates.some((date) => date.startsWith(monthPrefix))
  );
}

export function countJobsByTone(jobs: CalendarJob[]): {
  confirmed: number;
  provisional: number;
} {
  return jobs.reduce(
    (totals, job) => {
      totals[job.tone] += 1;
      return totals;
    },
    { confirmed: 0, provisional: 0 }
  );
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
