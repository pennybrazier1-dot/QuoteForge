import type { CalendarJob } from "@/lib/calendar/calendar-data";
import {
  formatVisitAddress,
  formatVisitDateLabel,
  formatVisitDuration,
  formatVisitTimeLabel,
  formatVisitType,
  type VisitRecord,
} from "@/lib/visits/types";

/**
 * Maps standalone visits into calendar jobs.
 * Uses site_visit tone so visits stay visually distinct from job bookings.
 */
export function buildCalendarJobsFromVisits(visits: VisitRecord[]): CalendarJob[] {
  return visits.map((visit) => {
    const timeLabel = formatVisitTimeLabel(visit.visit_time);
    const dateLabel = [
      formatVisitDateLabel(visit.visit_date),
      timeLabel,
      formatVisitDuration(visit.duration_minutes),
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      id: `visit-${visit.id}`,
      proposalId: visit.id,
      href: `/visits/${visit.id}`,
      title: formatVisitType(visit.visit_type),
      customer: visit.customer_name.trim() || "Customer",
      startDate: visit.visit_date,
      endDate: visit.visit_date,
      spanDates: [visit.visit_date],
      dateLabel,
      tone: "site_visit" as const,
      kind: "site_visit" as const,
      badgeLabel: formatVisitType(visit.visit_type),
      duration: formatVisitDuration(visit.duration_minutes),
      addressLine: formatVisitAddress(visit) || undefined,
    };
  });
}
