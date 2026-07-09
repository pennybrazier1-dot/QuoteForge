"use client";

import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";

const previewUrls = new Map<string, string>();
const listeners = new Set<() => void>();

function sessionKey(enquiryId: string, photoId: string): string {
  return `${enquiryId}:${photoId}`;
}

function notifyPhotoSessionChange(): void {
  invalidateDisplaySnapshot();
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
  return (
    getSessionPreviewUrl(enquiryId, photo.id) ??
    photo.thumbnailUrl ??
    photo.imageUrl ??
    null
  );
}

export function hasDisplayablePhotoPreviews(
  enquiryId: string,
  photos: EnquiryPhotoReference[]
): boolean {
  return photos.some((photo) => resolvePhotoDisplayUrl(enquiryId, photo) !== null);
}

export type EnquiryPhotoDisplay = EnquiryPhotoReference & {
  displayUrl: string | null;
};

let cachedDisplays: EnquiryPhotoDisplay[] = [];
let cachedDisplaysKey = "";

export function getEnquiryPhotoDisplaySnapshot(
  enquiryId: string,
  photos: EnquiryPhotoReference[]
): EnquiryPhotoDisplay[] {
  const urlsKey = photos
    .map((photo) => resolvePhotoDisplayUrl(enquiryId, photo) ?? "")
    .join("|");
  const key = `${enquiryId}:${photos.map((photo) => photo.id).join(",")}:${urlsKey}`;

  if (key === cachedDisplaysKey) {
    return cachedDisplays;
  }

  cachedDisplaysKey = key;
  cachedDisplays = photos.map((photo) => ({
    ...photo,
    displayUrl: resolvePhotoDisplayUrl(enquiryId, photo),
  }));

  return cachedDisplays;
}

function invalidateDisplaySnapshot(): void {
  cachedDisplaysKey = "";
}
