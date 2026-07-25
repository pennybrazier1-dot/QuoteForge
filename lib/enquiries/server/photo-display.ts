/**
 * UI-facing photo display models.
 * Keep these separate from raw `enquiry_media` database rows.
 */

export const SITE_VISIT_PHOTO_SIGNED_URL_SECONDS = 60 * 60;
/** Refresh when fewer than this many seconds remain on the signed URL. */
export const SITE_VISIT_PHOTO_SIGNED_URL_REFRESH_BUFFER_SECONDS = 5 * 60;

export type EnquiryPhotoStorageSource =
  | "server"
  | "local_unsynced"
  | "unavailable";

export type EnquiryPhotoDisplayItem = {
  id: string;
  enquiryId: string;
  siteVisitId: string | null;
  displayUrl: string | null;
  caption: string;
  mimeType: string;
  originalFilename: string;
  createdAt: string;
  storageSource: EnquiryPhotoStorageSource;
  signedUrlExpiresAt: string | null;
  byteSize: number;
};

export type EnquiryMediaForDisplay = {
  id: string;
  enquiry_id: string;
  site_visit_id: string | null;
  file_name: string;
  mime_type: string;
  byte_size: number;
  storage_path: string;
  captured_at: string;
  created_at: string;
  sort_order: number;
};

export function signedUrlExpiresAtFromNow(
  ttlSeconds: number = SITE_VISIT_PHOTO_SIGNED_URL_SECONDS,
  nowMs: number = Date.now()
): string {
  return new Date(nowMs + ttlSeconds * 1000).toISOString();
}

export function shouldRefreshSignedUrl(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
  bufferSeconds: number = SITE_VISIT_PHOTO_SIGNED_URL_REFRESH_BUFFER_SECONDS
): boolean {
  if (!expiresAt) {
    return true;
  }

  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return true;
  }

  return expiresMs - nowMs <= bufferSeconds * 1000;
}

export function mapMediaRowToUnavailableDisplay(
  row: EnquiryMediaForDisplay
): EnquiryPhotoDisplayItem {
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    siteVisitId: row.site_visit_id,
    displayUrl: null,
    caption: row.file_name || "Photo",
    mimeType: row.mime_type || "image/jpeg",
    originalFilename: row.file_name || "photo.jpg",
    createdAt: row.captured_at || row.created_at,
    storageSource: "unavailable",
    signedUrlExpiresAt: null,
    byteSize: Number(row.byte_size) || 0,
  };
}

export function mapMediaRowToServerDisplay(
  row: EnquiryMediaForDisplay,
  signedUrl: string,
  expiresAt: string
): EnquiryPhotoDisplayItem {
  return {
    id: row.id,
    enquiryId: row.enquiry_id,
    siteVisitId: row.site_visit_id,
    displayUrl: signedUrl,
    caption: row.file_name || "Photo",
    mimeType: row.mime_type || "image/jpeg",
    originalFilename: row.file_name || "photo.jpg",
    createdAt: row.captured_at || row.created_at,
    storageSource: "server",
    signedUrlExpiresAt: expiresAt,
    byteSize: Number(row.byte_size) || 0,
  };
}

export function buildLocalUnsyncedDisplay(options: {
  id: string;
  enquiryId: string;
  displayUrl: string;
  name?: string;
  mimeType?: string;
  byteSize?: number;
  createdAt?: string;
}): EnquiryPhotoDisplayItem {
  return {
    id: options.id,
    enquiryId: options.enquiryId,
    siteVisitId: null,
    displayUrl: options.displayUrl,
    caption: options.name || "Photo",
    mimeType: options.mimeType || "image/jpeg",
    originalFilename: options.name || "photo.jpg",
    createdAt: options.createdAt || new Date().toISOString(),
    storageSource: "local_unsynced",
    signedUrlExpiresAt: null,
    byteSize: options.byteSize ?? 0,
  };
}

/**
 * Prefer server-backed photos when the same id exists locally.
 * Local-only (unsynced) photos remain visible on this device.
 */
export function mergePhotoDisplays(
  serverItems: EnquiryPhotoDisplayItem[],
  localItems: EnquiryPhotoDisplayItem[]
): EnquiryPhotoDisplayItem[] {
  const byId = new Map<string, EnquiryPhotoDisplayItem>();

  for (const local of localItems) {
    byId.set(local.id, local);
  }

  for (const server of serverItems) {
    byId.set(server.id, server);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });
}
