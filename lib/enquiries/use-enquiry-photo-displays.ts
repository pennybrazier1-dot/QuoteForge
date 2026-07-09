"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import {
  getEnquiryPhotoDisplaySnapshot,
  subscribeToPhotoSession,
  type EnquiryPhotoDisplay,
} from "@/lib/enquiries/photo-session-store";

export function useEnquiryPhotoDisplays(
  enquiryId: string,
  photos: EnquiryPhotoReference[]
): EnquiryPhotoDisplay[] {
  const getSnapshot = useCallback(
    () => getEnquiryPhotoDisplaySnapshot(enquiryId, photos),
    [enquiryId, photos]
  );

  return useSyncExternalStore(
    subscribeToPhotoSession,
    getSnapshot,
    getSnapshot
  );
}
