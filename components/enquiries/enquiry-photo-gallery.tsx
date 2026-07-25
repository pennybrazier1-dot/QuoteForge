"use client";

import { useState } from "react";
import {
  formatEnquiryPhotoCount,
  formatEnquiryPhotoSummary,
} from "@/lib/enquiries/photo-metadata";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import { notifyEnquiryPhotosChanged } from "@/lib/enquiries/photo-display-events";
import { deleteEnquiryPhotoBlob } from "@/lib/enquiries/photo-blob-store";
import { clearSessionPhotosForEnquiry } from "@/lib/enquiries/photo-session-store";
import { deleteEnquiryPhotoAction } from "@/lib/enquiries/server/photo-actions";
import { useEnquiryPhotoDisplays } from "@/lib/enquiries/use-enquiry-photo-displays";

type EnquiryPhotoGalleryProps = {
  enquiryId: string;
  photos?: EnquiryPhotoReference[] | null;
  photoCount?: number | null;
  variant?: "card" | "detail";
  allowDelete?: boolean;
};

export function EnquiryPhotoGallery({
  enquiryId,
  photos,
  photoCount,
  variant = "detail",
  allowDelete = variant === "detail",
}: EnquiryPhotoGalleryProps) {
  const safePhotos = Array.isArray(photos) ? photos : [];
  const { displays, loading, error, refresh } = useEnquiryPhotoDisplays(
    enquiryId,
    safePhotos
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const count = Math.max(
    typeof photoCount === "number" && Number.isFinite(photoCount)
      ? photoCount
      : 0,
    safePhotos.length,
    displays.length
  );

  async function handleDelete(photoId: string, fileName: string) {
    const confirmed = window.confirm(
      `Delete photo “${fileName || "Photo"}”? This removes it from your workspace and cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(photoId);
    setDeleteError(null);

    const result = await deleteEnquiryPhotoAction(photoId);

    if (!result.ok) {
      setDeleteError(result.error);
      setDeletingId(null);
      return;
    }

    clearSessionPhotosForEnquiry(enquiryId, [photoId]);
    await deleteEnquiryPhotoBlob(enquiryId, photoId);
    notifyEnquiryPhotosChanged(enquiryId);
    await refresh();
    setDeletingId(null);
  }

  if (loading && displays.length === 0 && count === 0) {
    return variant === "detail" ? (
      <p className="qf-enquiry-detail-copy">Loading photos…</p>
    ) : null;
  }

  if (count === 0 && displays.length === 0 && !loading) {
    return variant === "detail" ? (
      <p className="qf-enquiry-detail-copy">No photos uploaded.</p>
    ) : null;
  }

  const thumbnails = displays.filter((photo) => photo.displayUrl);
  const unavailable = displays.filter((photo) => !photo.displayUrl);
  const visiblePhotos = variant === "card" ? thumbnails.slice(0, 3) : displays;
  const extraCount =
    variant === "card" && thumbnails.length > Math.min(3, thumbnails.length)
      ? Math.max(0, thumbnails.length - 3)
      : 0;
  const photosUnavailable =
    !loading && thumbnails.length === 0 && (displays.length > 0 || count > 0);

  if (photosUnavailable) {
    return (
      <div className="qf-enquiry-photo-status">
        <p
          className={
            variant === "card"
              ? "qf-enquiry-photo-summary"
              : "qf-enquiry-detail-copy qf-enquiry-photo-summary"
          }
        >
          {error
            ? error
            : formatEnquiryPhotoSummary(Math.max(count, displays.length), {
                unavailable: true,
              })}
        </p>
        {variant === "detail" ? (
          <button
            type="button"
            className="qf-btn-secondary qf-enquiry-photo-retry"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="qf-enquiry-photo-gallery-root">
      {error && variant === "detail" ? (
        <p className="qf-enquiry-photo-summary" role="status">
          {error}
        </p>
      ) : null}
      {deleteError ? (
        <p className="qf-enquiry-photo-summary text-destructive" role="alert">
          {deleteError}
        </p>
      ) : null}
      {loading && variant === "detail" ? (
        <p className="qf-enquiry-photo-summary">Updating photos…</p>
      ) : null}
      <div
        className={
          variant === "card" ? "qf-enquiry-card-photos" : "qf-enquiry-photo-grid"
        }
      >
        {visiblePhotos.map((photo) => (
          <figure
            key={photo.id}
            className={
              variant === "card"
                ? "qf-enquiry-photo-thumb-wrap"
                : "qf-enquiry-photo-gallery-item"
            }
          >
            {photo.displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.displayUrl}
                alt={photo.caption || "Customer photo"}
                className={
                  variant === "card"
                    ? "qf-enquiry-photo-thumb"
                    : "qf-enquiry-photo-image"
                }
                loading="lazy"
              />
            ) : (
              <div
                className={
                  variant === "card"
                    ? "qf-enquiry-photo-thumb qf-enquiry-photo-unavailable"
                    : "qf-enquiry-photo-image qf-enquiry-photo-unavailable"
                }
                role="img"
                aria-label="Photo unavailable"
              >
                Unavailable
              </div>
            )}
            {variant === "detail" ? (
              <figcaption className="qf-enquiry-photo-caption">
                <span>{photo.originalFilename || photo.caption || "Photo"}</span>
                {photo.storageSource === "local_unsynced" ? (
                  <span className="qf-enquiry-photo-source">On this device only</span>
                ) : null}
                {photo.storageSource === "unavailable" ? (
                  <span className="qf-enquiry-photo-source">Unavailable</span>
                ) : null}
              </figcaption>
            ) : null}
            {variant === "detail" &&
            allowDelete &&
            photo.storageSource !== "local_unsynced" ? (
              <button
                type="button"
                className="qf-btn-danger qf-enquiry-photo-delete"
                disabled={deletingId === photo.id}
                onClick={() =>
                  void handleDelete(photo.id, photo.originalFilename || photo.caption)
                }
              >
                {deletingId === photo.id ? "Deleting…" : "Delete photo"}
              </button>
            ) : null}
          </figure>
        ))}
        {extraCount > 0 ? (
          <div
            className="qf-enquiry-photo-more"
            aria-label={`${extraCount} more photos`}
          >
            +{extraCount}
          </div>
        ) : null}
      </div>
      {variant === "detail" && unavailable.length > 0 && thumbnails.length > 0 ? (
        <p className="qf-enquiry-photo-summary">
          {unavailable.length} photo
          {unavailable.length === 1 ? "" : "s"} could not be loaded.
        </p>
      ) : null}
      {variant === "detail" && thumbnails.length < count && count > displays.length ? (
        <p className="qf-enquiry-photo-summary qf-enquiry-detail-wide">
          {formatEnquiryPhotoCount(count)}
        </p>
      ) : null}
    </div>
  );
}
