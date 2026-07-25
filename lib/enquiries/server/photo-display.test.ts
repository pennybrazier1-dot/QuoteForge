import { describe, expect, it } from "vitest";
import {
  buildLocalUnsyncedDisplay,
  mapMediaRowToServerDisplay,
  mapMediaRowToUnavailableDisplay,
  mergePhotoDisplays,
  shouldRefreshSignedUrl,
  signedUrlExpiresAtFromNow,
} from "@/lib/enquiries/server/photo-display";

const baseRow = {
  id: "media-1",
  enquiry_id: "enquiry-1",
  site_visit_id: "visit-1",
  file_name: "kitchen.jpg",
  mime_type: "image/jpeg",
  byte_size: 1200,
  storage_path: "ws/enquiry-1/visit-1/media-1.jpg",
  captured_at: "2026-07-25T10:00:00.000Z",
  created_at: "2026-07-25T10:00:00.000Z",
  sort_order: 0,
};

describe("photo display helpers", () => {
  it("maps a signed media row to a server display item", () => {
    const item = mapMediaRowToServerDisplay(
      baseRow,
      "https://example.com/signed",
      "2026-07-25T11:00:00.000Z"
    );

    expect(item.storageSource).toBe("server");
    expect(item.displayUrl).toBe("https://example.com/signed");
    expect(item.enquiryId).toBe("enquiry-1");
    expect(item.signedUrlExpiresAt).toBe("2026-07-25T11:00:00.000Z");
  });

  it("maps missing objects to an unavailable display without crashing", () => {
    const item = mapMediaRowToUnavailableDisplay(baseRow);
    expect(item.storageSource).toBe("unavailable");
    expect(item.displayUrl).toBeNull();
  });

  it("prefers server photos over matching local photos", () => {
    const local = buildLocalUnsyncedDisplay({
      id: "media-1",
      enquiryId: "enquiry-1",
      displayUrl: "blob:local",
      name: "local.jpg",
    });
    const server = mapMediaRowToServerDisplay(
      baseRow,
      "https://example.com/signed",
      "2026-07-25T11:00:00.000Z"
    );
    const unsyncedOnly = buildLocalUnsyncedDisplay({
      id: "media-2",
      enquiryId: "enquiry-1",
      displayUrl: "blob:other",
      name: "other.jpg",
    });

    const merged = mergePhotoDisplays([server], [local, unsyncedOnly]);

    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.id === "media-1")?.storageSource).toBe(
      "server"
    );
    expect(merged.find((item) => item.id === "media-1")?.displayUrl).toBe(
      "https://example.com/signed"
    );
    expect(merged.find((item) => item.id === "media-2")?.storageSource).toBe(
      "local_unsynced"
    );
  });

  it("keeps unsynced local media visible when no server match exists", () => {
    const local = buildLocalUnsyncedDisplay({
      id: "local-only",
      enquiryId: "enquiry-1",
      displayUrl: "blob:local-only",
    });

    expect(mergePhotoDisplays([], [local])).toEqual([local]);
  });

  it("detects signed URLs that need refresh before expiry", () => {
    const now = Date.parse("2026-07-25T10:55:00.000Z");
    expect(
      shouldRefreshSignedUrl("2026-07-25T11:00:00.000Z", now, 5 * 60)
    ).toBe(true);
    expect(
      shouldRefreshSignedUrl("2026-07-25T12:00:00.000Z", now, 5 * 60)
    ).toBe(false);
    expect(shouldRefreshSignedUrl(null, now)).toBe(true);
  });

  it("builds expiry timestamps from ttl seconds", () => {
    const expires = signedUrlExpiresAtFromNow(
      3600,
      Date.parse("2026-07-25T10:00:00.000Z")
    );
    expect(expires).toBe("2026-07-25T11:00:00.000Z");
  });
});
