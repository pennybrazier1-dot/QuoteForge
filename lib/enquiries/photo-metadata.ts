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

export function normalizePhotoReference(value: unknown): EnquiryPhotoReference | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<EnquiryPhotoReference> & { dataUrl?: string };

  if (typeof raw.id !== "string") {
    return null;
  }

  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : "Photo",
    size: typeof raw.size === "number" ? raw.size : 0,
    type: typeof raw.type === "string" ? raw.type : "",
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    storageKey: typeof raw.storageKey === "string" ? raw.storageKey : null,
    thumbnailUrl: typeof raw.thumbnailUrl === "string" ? raw.thumbnailUrl : null,
  };
}

export function formatEnquiryPhotoCount(count: number): string {
  const safeCount = Math.max(0, count);
  return `${safeCount} photo${safeCount === 1 ? "" : "s"} uploaded`;
}
