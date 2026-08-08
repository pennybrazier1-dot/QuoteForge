"use client";

import { useEffect, useState } from "react";
import type { CalendarJob } from "@/lib/calendar/calendar-data";
import { listVisitCalendarJobsAction } from "@/lib/visits/actions";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

export function useServerVisitJobs(): CalendarJob[] {
  const mounted = useClientMounted();
  const [jobs, setJobs] = useState<CalendarJob[]>([]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;

    void listVisitCalendarJobsAction().then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setJobs([]);
        return;
      }
      setJobs(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  return jobs;
}
