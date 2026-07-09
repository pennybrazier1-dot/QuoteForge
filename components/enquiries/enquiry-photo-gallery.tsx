"use client";

import { formatEnquiryPhotoCount } from "@/lib/enquiries/photo-metadata";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import { useEnquiryPhotoDisplays } from "@/lib/enquiries/use-enquiry-photo-displays";

type EnquiryPhotoGalleryProps = {
  enquiryId: string;
  photos: EnquiryPhotoReference[];
  photoCount: number;
  variant?: "card" | "detail";
};

export function EnquiryPhotoGallery({
  enquiryId,
  photos,
  photoCount,
  variant = "detail",
}: EnquiryPhotoGalleryProps) {
  const displays = useEnquiryPhotoDisplays(enquiryId, photos);
  const count = photoCount || photos.length;

  if (count === 0) {
    return variant === "detail" ? (
      <p className="qf-enquiry-detail-copy">No photos uploaded.</p>
    ) : null;
  }

  const thumbnails = displays.filter((photo) => photo.displayUrl);
  const visiblePhotos = variant === "card" ? thumbnails.slice(0, 3) : thumbnails;
  const extraCount =
    variant === "card" && thumbnails.length > visiblePhotos.length
      ? thumbnails.length - visiblePhotos.length
      : 0;

  if (visiblePhotos.length === 0) {
    return (
      <p
        className={
          variant === "card"
            ? "qf-enquiry-photo-summary"
            : "qf-enquiry-detail-copy qf-enquiry-photo-summary"
        }
      >
        {formatEnquiryPhotoCount(count)}
      </p>
    );
  }

  return (
    <div
      className={
        variant === "card"
          ? "qf-enquiry-card-photos"
          : "qf-enquiry-photo-grid"
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.displayUrl ?? ""}
            alt={photo.name || "Customer photo"}
            className={
              variant === "card"
                ? "qf-enquiry-photo-thumb"
                : "qf-enquiry-photo-image"
            }
            loading="lazy"
          />
          {variant === "detail" ? (
            <figcaption className="qf-enquiry-photo-caption">
              {photo.name || "Photo"}
            </figcaption>
          ) : null}
        </figure>
      ))}
      {extraCount > 0 ? (
        <div className="qf-enquiry-photo-more" aria-label={`${extraCount} more photos`}>
          +{extraCount}
        </div>
      ) : null}
      {variant === "detail" && thumbnails.length < count ? (
        <p className="qf-enquiry-photo-summary qf-enquiry-detail-wide">
          {formatEnquiryPhotoCount(count)}
        </p>
      ) : null}
    </div>
  );
}
