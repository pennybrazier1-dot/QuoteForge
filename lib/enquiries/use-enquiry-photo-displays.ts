"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEnquiryPhotoBlob,
  listPhotoBlobIdsForEnquiry,
} from "@/lib/enquiries/photo-blob-store";
import { subscribeEnquiryPhotosChanged } from "@/lib/enquiries/photo-display-events";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import {
  getSessionPreviewUrl,
  hydrateSessionPhotosForEnquiry,
  subscribeToPhotoSession,
} from "@/lib/enquiries/photo-session-store";
import {
  listEnquiryPhotoDisplaysAction,
  refreshEnquiryPhotoSignedUrlAction,
} from "@/lib/enquiries/server/photo-actions";
import {
  buildLocalUnsyncedDisplay,
  mergePhotoDisplays,
  shouldRefreshSignedUrl,
  type EnquiryPhotoDisplayItem,
} from "@/lib/enquiries/server/photo-display";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

export type UseEnquiryPhotoDisplaysResult = {
  displays: EnquiryPhotoDisplayItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function buildLocalDisplaysFromKnownIds(
  enquiryId: string,
  photoIds: string[],
  photoRefs: EnquiryPhotoReference[]
): EnquiryPhotoDisplayItem[] {
  const refById = new Map(photoRefs.map((photo) => [photo.id, photo]));

  return photoIds.flatMap((photoId) => {
    const previewUrl = getSessionPreviewUrl(enquiryId, photoId);
    if (!previewUrl) {
      return [];
    }

    const ref = refById.get(photoId);
    return [
      buildLocalUnsyncedDisplay({
        id: photoId,
        enquiryId,
        displayUrl: previewUrl,
        name: ref?.name,
        mimeType: ref?.type,
        byteSize: ref?.size,
      }),
    ];
  });
}

export function useEnquiryPhotoDisplays(
  enquiryId: string,
  photos: EnquiryPhotoReference[] | null | undefined
): UseEnquiryPhotoDisplaysResult {
  const mounted = useClientMounted();
  const safePhotos = useMemo(
    () => (Array.isArray(photos) ? photos : []),
    [photos]
  );
  const photoIdsKey = safePhotos.map((photo) => photo.id).join(",");

  const [serverItems, setServerItems] = useState<EnquiryPhotoDisplayItem[]>([]);
  const [localItems, setLocalItems] = useState<EnquiryPhotoDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [sessionTick, setSessionTick] = useState(0);

  const refresh = useCallback(async () => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    return subscribeEnquiryPhotosChanged((changedEnquiryId) => {
      if (changedEnquiryId === enquiryId) {
        setReloadToken((value) => value + 1);
      }
    });
  }, [enquiryId]);

  useEffect(() => {
    return subscribeToPhotoSession(() => {
      setSessionTick((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (!mounted || !enquiryId) {
      return;
    }

    let cancelled = false;

    void listEnquiryPhotoDisplaysAction(enquiryId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setServerItems([]);
        setLoading(false);
        return;
      }

      setError(null);
      setServerItems(result.data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, enquiryId, reloadToken]);

  useEffect(() => {
    if (!mounted || !enquiryId) {
      return;
    }

    let cancelled = false;
    const serverIds = new Set(serverItems.map((item) => item.id));

    void (async () => {
      const blobIds = await listPhotoBlobIdsForEnquiry(enquiryId);
      const knownIds = Array.from(
        new Set([...safePhotos.map((photo) => photo.id), ...blobIds])
      );

      const candidateIds = knownIds.filter((photoId) => !serverIds.has(photoId));

      if (candidateIds.length > 0) {
        await hydrateSessionPhotosForEnquiry(
          enquiryId,
          candidateIds.map((id) => {
            const existing = safePhotos.find((photo) => photo.id === id);
            return (
              existing ?? {
                id,
                name: "Photo",
                size: 0,
                type: "image/jpeg",
                imageUrl: null,
                storageKey: null,
                thumbnailUrl: null,
              }
            );
          })
        );
      }

      if (cancelled) {
        return;
      }

      const unsyncedIds: string[] = [];

      for (const photoId of candidateIds) {
        if (getSessionPreviewUrl(enquiryId, photoId)) {
          unsyncedIds.push(photoId);
          continue;
        }

        const blob = await getEnquiryPhotoBlob(enquiryId, photoId);
        if (blob) {
          unsyncedIds.push(photoId);
        }
      }

      if (cancelled) {
        return;
      }

      if (unsyncedIds.length > 0) {
        await hydrateSessionPhotosForEnquiry(
          enquiryId,
          unsyncedIds.map((id) => {
            const existing = safePhotos.find((photo) => photo.id === id);
            return (
              existing ?? {
                id,
                name: "Photo",
                size: 0,
                type: "image/jpeg",
                imageUrl: null,
                storageKey: null,
                thumbnailUrl: null,
              }
            );
          })
        );
      }

      if (cancelled) {
        return;
      }

      setLocalItems(
        buildLocalDisplaysFromKnownIds(enquiryId, unsyncedIds, safePhotos)
      );
    })();

    return () => {
      cancelled = true;
    };
    // sessionTick rebuilds local previews after registerSessionPhotosFromFiles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, enquiryId, photoIdsKey, serverItems, sessionTick]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const stale = serverItems.filter(
      (item) =>
        item.storageSource === "server" &&
        shouldRefreshSignedUrl(item.signedUrlExpiresAt)
    );

    if (stale.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      stale.map(async (item) => {
        const result = await refreshEnquiryPhotoSignedUrlAction(item.id);
        return result.ok ? result.data : item;
      })
    ).then((refreshed) => {
      if (cancelled) {
        return;
      }

      const refreshedById = new Map(refreshed.map((item) => [item.id, item]));
      setServerItems((current) =>
        current.map((item) => refreshedById.get(item.id) ?? item)
      );
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, serverItems]);

  const displays = useMemo(
    () => mergePhotoDisplays(serverItems, localItems),
    [serverItems, localItems]
  );

  return {
    displays,
    loading,
    error,
    refresh,
  };
}
