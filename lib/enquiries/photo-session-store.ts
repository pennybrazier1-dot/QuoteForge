"use client";

import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import { saveEnquiryPhotoBlob, getEnquiryPhotoBlob } from "@/lib/enquiries/photo-blob-store";

const previewUrls = new Map<string, string>();
const listeners = new Set<() => void>();
const displayCache = new Map<string, EnquiryPhotoDisplay[]>();
const hydrationPromises = new Map<string, Promise<void>>();

function sessionKey(enquiryId: string, photoId: string): string {
  return `${enquiryId}:${photoId}`;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  if (file.type && file.type !== "application/octet-stream") {
    return false;
  }

  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(file.name);
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

function registerSessionPreviewUrl(
  enquiryId: string,
  photoId: string,
  previewUrl: string
): void {
  const key = sessionKey(enquiryId, photoId);
  const existing = previewUrls.get(key);

  if (existing === previewUrl) {
    return;
  }

  if (existing) {
    URL.revokeObjectURL(existing);
  }

  previewUrls.set(key, previewUrl);
}

export function registerSessionPhotosFromFiles(
  enquiryId: string,
  photos: EnquiryPhotoReference[],
  files: File[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  let changed = false;

  photos.forEach((photo, index) => {
    const file = files[index];
    if (!file || !isImageFile(file)) {
      return;
    }

    registerSessionPreviewUrl(
      enquiryId,
      photo.id,
      URL.createObjectURL(file)
    );
    changed = true;

    void saveEnquiryPhotoBlob(enquiryId, photo.id, file);
  });

  if (changed) {
    notifyPhotoSessionChange();
  }
}

export async function hydrateSessionPhotosForEnquiry(
  enquiryId: string,
  photos: EnquiryPhotoReference[]
): Promise<void> {
  if (typeof window === "undefined" || photos.length === 0) {
    return;
  }

  const cacheKey = `${enquiryId}:${photos.map((photo) => photo.id).join(",")}`;
  const existing = hydrationPromises.get(cacheKey);

  if (existing) {
    await existing;
    return;
  }

  const hydration = (async () => {
    let changed = false;

    for (const photo of photos) {
      const key = sessionKey(enquiryId, photo.id);

      if (previewUrls.has(key)) {
        continue;
      }

      const blob = await getEnquiryPhotoBlob(enquiryId, photo.id);

      if (!blob) {
        continue;
      }

      registerSessionPreviewUrl(enquiryId, photo.id, URL.createObjectURL(blob));
      changed = true;
    }

    if (changed) {
      notifyPhotoSessionChange();
    }
  })();

  hydrationPromises.set(cacheKey, hydration);

  try {
    await hydration;
  } finally {
    hydrationPromises.delete(cacheKey);
  }
}

export function clearSessionPhotosForEnquiry(
  enquiryId: string,
  photoIds: string[] = []
): void {
  if (typeof window === "undefined" || photoIds.length === 0) {
    return;
  }

  let changed = false;

  photoIds.forEach((photoId) => {
    const key = sessionKey(enquiryId, photoId);
    const existing = previewUrls.get(key);

    if (!existing) {
      return;
    }

    URL.revokeObjectURL(existing);
    previewUrls.delete(key);
    changed = true;
  });

  if (changed) {
    notifyPhotoSessionChange();
  }
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
