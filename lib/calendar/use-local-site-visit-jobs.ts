"use client";

import { useCallback, useSyncExternalStore } from "react";
import { buildLocalSiteVisitJobs } from "@/lib/calendar/local-calendar-data";
import {
  getLocalSiteVisitEvents,
  subscribeToLocalCalendarEvents,
} from "@/lib/calendar/local-calendar-store";

export function useLocalSiteVisitJobs() {
  const getSnapshot = useCallback(
    () => buildLocalSiteVisitJobs(getLocalSiteVisitEvents()),
    []
  );

  return useSyncExternalStore(
    subscribeToLocalCalendarEvents,
    getSnapshot,
    () => []
  );
}
