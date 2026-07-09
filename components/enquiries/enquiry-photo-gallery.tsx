import type { EnquiryPhotoPreview } from "@/lib/enquiries/types";

type EnquiryPhotoGalleryProps = {
  photos: EnquiryPhotoPreview[];
  variant?: "card" | "detail";
};

export function EnquiryPhotoGallery({
  photos,
  variant = "detail",
}: EnquiryPhotoGalleryProps) {
  if (photos.length === 0) {
    return null;
  }

  const visiblePhotos =
    variant === "card" ? photos.slice(0, 3) : photos;
  const extraCount =
    variant === "card" && photos.length > visiblePhotos.length
      ? photos.length - visiblePhotos.length
      : 0;

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
            src={photo.dataUrl}
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
    </div>
  );
}
