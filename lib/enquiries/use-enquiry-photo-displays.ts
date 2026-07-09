"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import {
  getEnquiryPhotoDisplaySnapshot,
  hydrateSessionPhotosForEnquiry,
  subscribeToPhotoSession,
  type EnquiryPhotoDisplay,
} from "@/lib/enquiries/photo-session-store";

const SERVER_PHOTO_DISPLAYS: EnquiryPhotoDisplay[] = [];

export function useEnquiryPhotoDisplays(
  enquiryId: string,
  photos: EnquiryPhotoReference[] | null | undefined
): EnquiryPhotoDisplay[] {
  const safePhotos = useMemo(
    () => (Array.isArray(photos) ? photos : []),
    [photos]
  );
  const photoIdsKey = safePhotos.map((photo) => photo.id).join(",");

  const getSnapshot = useCallback(
    () => getEnquiryPhotoDisplaySnapshot(enquiryId, safePhotos),
    [enquiryId, safePhotos]
  );

  const displays = useSyncExternalStore(
    subscribeToPhotoSession,
    getSnapshot,
    () => SERVER_PHOTO_DISPLAYS
  );

  useEffect(() => {
    if (!photoIdsKey) {
      return;
    }

    const snapshot = getEnquiryPhotoDisplaySnapshot(enquiryId, safePhotos);

    if (snapshot.some((photo) => photo.displayUrl)) {
      return;
    }

    void hydrateSessionPhotosForEnquiry(enquiryId, safePhotos);
    // safePhotos identity is captured via photoIdsKey above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiryId, photoIdsKey]);

  return displays;
}
