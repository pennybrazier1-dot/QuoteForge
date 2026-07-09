"use client";

import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";

const previewUrls = new Map<string, string>();
const listeners = new Set<() => void>();
const displayCache = new Map<string, EnquiryPhotoDisplay[]>();

function sessionKey(enquiryId: string, photoId: string): string {
  return `${enquiryId}:${photoId}`;
}

function notifyPhotoSessionChange(): void {
  displayCache.clear();
  listeners.forEach((listener) => listener());
}

export function subscribeToPhotoSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerSessionPhotosFromFiles(
  enquiryId: string,
  photos: EnquiryPhotoReference[],
  files: File[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  photos.forEach((photo, index) => {
    const file = files[index];
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const key = sessionKey(enquiryId, photo.id);
    const existing = previewUrls.get(key);

    if (existing) {
      URL.revokeObjectURL(existing);
    }

    previewUrls.set(key, URL.createObjectURL(file));
  });

  notifyPhotoSessionChange();
}

export function getSessionPreviewUrl(
  enquiryId: string,
  photoId: string
): string | null {
  return previewUrls.get(sessionKey(enquiryId, photoId)) ?? null;
}

export function resolvePhotoDisplayUrl(
  enquiryId: string,
  photo: EnquiryPhotoReference
): string | null {
  const sessionUrl = getSessionPreviewUrl(enquiryId, photo.id);
  if (sessionUrl) {
    return sessionUrl;
  }

  const thumbnailUrl = photo.thumbnailUrl?.trim() ?? "";
  if (thumbnailUrl && !thumbnailUrl.startsWith("data:")) {
    return thumbnailUrl;
  }

  const imageUrl = photo.imageUrl?.trim() ?? "";
  if (imageUrl && !imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  return null;
}

export type EnquiryPhotoDisplay = EnquiryPhotoReference & {
  displayUrl: string | null;
};

export function getEnquiryPhotoDisplaySnapshot(
  enquiryId: string,
  photos: EnquiryPhotoReference[] | null | undefined
): EnquiryPhotoDisplay[] {
  const safePhotos = Array.isArray(photos) ? photos : [];
  const urlsKey = safePhotos
    .map((photo) => resolvePhotoDisplayUrl(enquiryId, photo) ?? "")
    .join("|");
  const cacheKey = `${enquiryId}:${safePhotos.map((photo) => photo.id).join(",")}:${urlsKey}`;

  const cached = displayCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const snapshot = safePhotos.map((photo) => ({
    ...photo,
    displayUrl: resolvePhotoDisplayUrl(enquiryId, photo),
  }));

  displayCache.set(cacheKey, snapshot);
  return snapshot;
}
