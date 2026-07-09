import { describe, expect, it, vi } from "vitest";
import {
  buildPhotoMetadataFromFiles,
  formatEnquiryPhotoCount,
  normalizePhotoReference,
} from "@/lib/enquiries/photo-metadata";

describe("photo metadata", () => {
  it("stores lightweight metadata without image bytes", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValue("photo-1"),
    });

    const photos = buildPhotoMetadataFromFiles([
      {
        name: "kitchen.jpg",
        size: 2_400_000,
        type: "image/jpeg",
      } as File,
    ]);

    expect(photos).toEqual([
      {
        id: "photo-1",
        name: "kitchen.jpg",
        size: 2_400_000,
        type: "image/jpeg",
        imageUrl: null,
        storageKey: null,
        thumbnailUrl: null,
      },
    ]);
  });

  it("strips legacy dataUrl fields when normalizing stored photos", () => {
    const photo = normalizePhotoReference({
      id: "legacy-photo",
      name: "kitchen.jpg",
      dataUrl: "data:image/jpeg;base64,huge-payload",
    });

    expect(photo).toEqual({
      id: "legacy-photo",
      name: "kitchen.jpg",
      size: 0,
      type: "",
      imageUrl: null,
      storageKey: null,
      thumbnailUrl: null,
    });
    expect(photo).not.toHaveProperty("dataUrl");
  });

  it("formats photo counts for summary text", () => {
    expect(formatEnquiryPhotoCount(1)).toBe("1 photo uploaded");
    expect(formatEnquiryPhotoCount(4)).toBe("4 photos uploaded");
  });
});
