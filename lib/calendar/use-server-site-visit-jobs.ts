"use client";

import { useEffect, useState } from "react";
import type { CalendarJob } from "@/lib/calendar/calendar-data";
import { listSiteVisitCalendarJobsAction } from "@/lib/enquiries/server/actions";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

type ServerSiteVisitJob = {
  id: string;
  enquiryId: string;
  title: string;
  customerName: string;
  address: string;
  startsAt: string;
  dateIso: string;
  slotLabel: string;
  status: "site_visit_booked";
};

function mapServerJobsToCalendarJobs(jobs: ServerSiteVisitJob[]): CalendarJob[] {
  return jobs.map((event) => ({
    id: event.id,
    proposalId: event.enquiryId,
    href: `/enquiries/${event.enquiryId}`,
    title: event.title,
    customer: event.customerName,
    startDate: event.dateIso,
    endDate: event.dateIso,
    spanDates: [event.dateIso],
    dateLabel: event.slotLabel,
    tone: "site_visit" as const,
    kind: "site_visit" as const,
    badgeLabel: "Site Visit Booked",
    addressLine: event.address || undefined,
  }));
}

export function useServerSiteVisitJobs(): CalendarJob[] {
  const mounted = useClientMounted();
  const [jobs, setJobs] = useState<CalendarJob[]>([]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;

    void listSiteVisitCalendarJobsAction().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setJobs([]);
        return;
      }

      setJobs(mapServerJobsToCalendarJobs(result.data));
    });

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  return jobs;
}
