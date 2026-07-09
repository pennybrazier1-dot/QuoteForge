"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import {
  getEnquiryPhotoDisplaySnapshot,
  subscribeToPhotoSession,
  type EnquiryPhotoDisplay,
} from "@/lib/enquiries/photo-session-store";

const SERVER_PHOTO_DISPLAYS: EnquiryPhotoDisplay[] = [];

export function useEnquiryPhotoDisplays(
  enquiryId: string,
  photos: EnquiryPhotoReference[] | null | undefined
): EnquiryPhotoDisplay[] {
  const getSnapshot = useCallback(
    () => getEnquiryPhotoDisplaySnapshot(enquiryId, photos),
    [enquiryId, photos]
  );

  return useSyncExternalStore(
    subscribeToPhotoSession,
    getSnapshot,
    () => SERVER_PHOTO_DISPLAYS
  );
}
