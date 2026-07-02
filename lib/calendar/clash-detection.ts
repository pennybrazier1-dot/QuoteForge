import type { CalendarEventTone, CalendarJob } from "@/lib/calendar/calendar-data";
import { parseIsoDate, startOfWeek, toIsoDate } from "@/lib/calendar/calendar-data";
import {
  expandJobSpanDates,
  parseDurationToCalendarDays,
} from "@/lib/calendar/job-span";
import type { BookingConfirmation } from "@/lib/proposals/booking";

export type ClashSeverity = "strong" | "warning" | "soft";

export type BookingClash = {
  id: string;
  severity: ClashSeverity;
  message: string;
  jobTitle: string;
  customer: string;
  overlappingDates: string[];
};

export type ClashAnalysis = {
  clashes: BookingClash[];
  hasStrongOrWarning: boolean;
  hasSoft: boolean;
  suggestedStartDate: string | null;
  proposedSpanDates: string[];
};

export type ProposedBookingInput = {
  proposalId: string;
  startDateIso: string | null;
  duration: string | null | undefined;
  bookingStatus: BookingConfirmation;
};

const SEVERITY_RANK: Record<ClashSeverity, number> = {
  strong: 3,
  warning: 2,
  soft: 1,
};

function getOverlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);

  return left.filter((date) => rightSet.has(date));
}

function getClashSeverity(
  proposed: BookingConfirmation,
  existing: CalendarEventTone
): ClashSeverity {
  if (proposed === "confirmed" && existing === "confirmed") {
    return "strong";
  }

  if (proposed === "provisional" && existing === "confirmed") {
    return "warning";
  }

  if (proposed === "confirmed" && existing === "provisional") {
    return "warning";
  }

  return "soft";
}

function getClashMessage(
  severity: ClashSeverity,
  existingTone: CalendarEventTone,
  hasDateOverlap: boolean
): string {
  if (severity === "strong") {
    return "You already have a confirmed job on this date.";
  }

  if (existingTone === "provisional" && hasDateOverlap) {
    return "This date is provisionally held for another job.";
  }

  if (existingTone === "confirmed") {
    return "You already have a confirmed job on this date.";
  }

  if (severity === "soft") {
    return "You may be double-booking this week.";
  }

  return "This date is provisionally held for another job.";
}

function spansShareWeek(spanA: string[], spanB: string[]): boolean {
  const weeksB = new Set(spanB.map((iso) => startOfWeek(parseIsoDate(iso))));

  return spanA.some((iso) => weeksB.has(startOfWeek(parseIsoDate(iso))));
}

export function buildProposedSpanDates(
  startDateIso: string | null,
  duration: string | null | undefined
): string[] {
  if (!startDateIso) {
    return [];
  }

  const dayCount = parseDurationToCalendarDays(duration);

  return expandJobSpanDates(startDateIso, dayCount);
}

export function findNextAvailableStartDate(
  existingJobs: CalendarJob[],
  durationDayCount: number,
  searchFromIso: string,
  maxDaysToSearch = 120
): string | null {
  const confirmedJobs = existingJobs.filter((job) => job.tone === "confirmed");
  const candidate = parseIsoDate(searchFromIso);
  const today = parseIsoDate(toIsoDate(new Date()));

  if (candidate < today) {
    candidate.setTime(today.getTime());
  }

  for (let offset = 0; offset < maxDaysToSearch; offset += 1) {
    const startIso = toIsoDate(candidate);
    const span = expandJobSpanDates(startIso, durationDayCount);
    const hasConfirmedOverlap = confirmedJobs.some(
      (job) => getOverlap(span, job.spanDates).length > 0
    );

    if (!hasConfirmedOverlap) {
      return startIso;
    }

    candidate.setDate(candidate.getDate() + 1);
  }

  return null;
}

export function formatSuggestedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parseIsoDate(iso));
}

export function analyzeBookingClashes(
  proposed: ProposedBookingInput,
  existingJobs: CalendarJob[]
): ClashAnalysis {
  const proposedSpanDates = buildProposedSpanDates(
    proposed.startDateIso,
    proposed.duration
  );

  if (proposedSpanDates.length === 0) {
    return {
      clashes: [],
      hasStrongOrWarning: false,
      hasSoft: false,
      suggestedStartDate: null,
      proposedSpanDates: [],
    };
  }

  const otherJobs = existingJobs.filter(
    (job) => job.proposalId !== proposed.proposalId
  );
  const clashes: BookingClash[] = [];

  for (const job of otherJobs) {
    const overlappingDates = getOverlap(proposedSpanDates, job.spanDates);
    const weekOverlap =
      overlappingDates.length === 0 &&
      proposed.bookingStatus === "provisional" &&
      job.tone === "provisional" &&
      spansShareWeek(proposedSpanDates, job.spanDates);

    if (overlappingDates.length === 0 && !weekOverlap) {
      continue;
    }

    const severity = getClashSeverity(proposed.bookingStatus, job.tone);

    clashes.push({
      id: job.id,
      severity,
      message: getClashMessage(
        severity,
        job.tone,
        overlappingDates.length > 0
      ),
      jobTitle: job.title,
      customer: job.customer,
      overlappingDates:
        overlappingDates.length > 0 ? overlappingDates : proposedSpanDates,
    });
  }

  const byJob = new Map<string, BookingClash>();

  for (const clash of clashes) {
    const current = byJob.get(clash.id);

    if (
      !current ||
      SEVERITY_RANK[clash.severity] > SEVERITY_RANK[current.severity]
    ) {
      byJob.set(clash.id, clash);
    }
  }

  const deduped = Array.from(byJob.values()).sort(
    (left, right) => SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity]
  );

  const suggestedStartDate =
    deduped.length > 0
      ? findNextAvailableStartDate(
          otherJobs,
          proposedSpanDates.length,
          proposed.startDateIso ?? toIsoDate(new Date())
        )
      : null;

  return {
    clashes: deduped,
    hasStrongOrWarning: deduped.some(
      (clash) => clash.severity === "strong" || clash.severity === "warning"
    ),
    hasSoft: deduped.some((clash) => clash.severity === "soft"),
    suggestedStartDate,
    proposedSpanDates,
  };
}
