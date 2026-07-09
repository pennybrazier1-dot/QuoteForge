"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getSiteVisitSession,
  subscribeToSiteVisitSessions,
} from "@/lib/site-visit/site-visit-session-store";
import type { SiteVisitSession } from "@/lib/site-visit/types";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

export function useSiteVisitSession(enquiryId: string): SiteVisitSession | null {
  const mounted = useClientMounted();

  const getSnapshot = useCallback(() => {
    if (!mounted) {
      return null;
    }

    return getSiteVisitSession(enquiryId);
  }, [mounted, enquiryId]);

  return useSyncExternalStore(
    subscribeToSiteVisitSessions,
    getSnapshot,
    () => null
  );
}
