/**
 * Lightweight photo reference stored with an enquiry.
 * No image bytes — ready to swap in backend URLs later.
 */
export type EnquiryPhotoReference = {
  id: string;
  name: string;
  size: number;
  type: string;
  imageUrl?: string | null;
  storageKey?: string | null;
  thumbnailUrl?: string | null;
};

const MAX_STORED_PHOTOS = 12;

export function buildPhotoMetadataFromFiles(
  files: File[]
): EnquiryPhotoReference[] {
  return files.slice(0, MAX_STORED_PHOTOS).map((file) => ({
    id: crypto.randomUUID(),
    name: file.name || "Photo",
    size: file.size,
    type: file.type || "application/octet-stream",
    imageUrl: null,
    storageKey: null,
    thumbnailUrl: null,
  }));
}

export function normalizePhotoReference(
  value: unknown,
  options?: { fallbackId?: string }
): EnquiryPhotoReference | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<EnquiryPhotoReference> & { dataUrl?: string };
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id
      : options?.fallbackId ?? null;

  if (!id) {
    return null;
  }

  // Never persist or surface legacy base64 payloads as display URLs.
  const imageUrl =
    typeof raw.imageUrl === "string" &&
    raw.imageUrl.trim() &&
    !raw.imageUrl.startsWith("data:")
      ? raw.imageUrl
      : null;

  const thumbnailUrl =
    typeof raw.thumbnailUrl === "string" &&
    raw.thumbnailUrl.trim() &&
    !raw.thumbnailUrl.startsWith("data:")
      ? raw.thumbnailUrl
      : null;

  return {
    id,
    name: typeof raw.name === "string" ? raw.name : "Photo",
    size: typeof raw.size === "number" && Number.isFinite(raw.size) ? raw.size : 0,
    type: typeof raw.type === "string" ? raw.type : "",
    imageUrl,
    storageKey: typeof raw.storageKey === "string" ? raw.storageKey : null,
    thumbnailUrl,
  };
}

export function formatEnquiryPhotoCount(count: number): string {
  const safeCount = Math.max(0, count);
  return `${safeCount} photo${safeCount === 1 ? "" : "s"} uploaded`;
}

export function formatEnquiryPhotoSummary(
  count: number,
  options?: { unavailable?: boolean }
): string {
  const safeCount = Math.max(0, count);

  if (safeCount === 0) {
    return "No photos uploaded";
  }

  if (options?.unavailable) {
    return "Photos unavailable";
  }

  return formatEnquiryPhotoCount(safeCount);
}
