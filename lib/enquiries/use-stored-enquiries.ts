"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_ENQUIRIES,
  getStoredEnquiries,
  getStoredEnquiry,
  subscribeToEnquiries,
} from "@/lib/enquiries/enquiry-store";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

export function useStoredEnquiries(): StoredEnquiry[] {
  const mounted = useClientMounted();

  const getSnapshot = useCallback(() => {
    if (!mounted) {
      return EMPTY_ENQUIRIES;
    }

    return getStoredEnquiries();
  }, [mounted]);

  return useSyncExternalStore(
    subscribeToEnquiries,
    getSnapshot,
    () => EMPTY_ENQUIRIES
  );
}

export function useStoredEnquiry(id: string): StoredEnquiry | null {
  const mounted = useClientMounted();

  const getSnapshot = useCallback(() => {
    if (!mounted) {
      return null;
    }

    return getStoredEnquiry(id);
  }, [mounted, id]);

  return useSyncExternalStore(subscribeToEnquiries, getSnapshot, () => null);
}
