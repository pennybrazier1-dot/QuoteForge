"use client";

/**
 * Lightweight pub/sub so upload/delete can refresh galleries without
 * regenerating signed URLs on every unrelated React render.
 */
const listeners = new Set<(enquiryId: string) => void>();

export function notifyEnquiryPhotosChanged(enquiryId: string): void {
  listeners.forEach((listener) => listener(enquiryId));
}

export function subscribeEnquiryPhotosChanged(
  listener: (enquiryId: string) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
