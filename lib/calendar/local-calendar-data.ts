import type { CalendarJob } from "@/lib/calendar/calendar-data";
import type { LocalSiteVisitEvent } from "@/lib/calendar/local-calendar-store";

export function buildLocalSiteVisitJobs(
  events: LocalSiteVisitEvent[]
): CalendarJob[] {
  return events.map((event) => ({
    id: event.id,
    proposalId: event.enquiryId,
    href: `/enquiries/${event.enquiryId}`,
    title: event.title,
    customer: event.customerName,
    startDate: event.dateIso,
    endDate: event.dateIso,
    spanDates: [event.dateIso],
    dateLabel: event.slotLabel,
    tone: "site_visit",
    kind: "site_visit",
    badgeLabel: "Site Visit Booked",
    addressLine: event.address || undefined,
  }));
}

export function mergeCalendarJobs(
  proposalJobs: CalendarJob[],
  localJobs: CalendarJob[]
): CalendarJob[] {
  const localIds = new Set(localJobs.map((job) => job.id));

  return [...proposalJobs.filter((job) => !localIds.has(job.id)), ...localJobs].sort(
    (left, right) => left.startDate.localeCompare(right.startDate)
  );
}
