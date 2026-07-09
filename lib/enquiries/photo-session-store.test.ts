import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEnquiryPhotoDisplaySnapshot,
  isImageFile,
  registerSessionPhotosFromFiles,
} from "@/lib/enquiries/photo-session-store";

describe("isImageFile", () => {
  it("accepts common image files even when the browser omits mime type", () => {
    expect(isImageFile({ name: "kitchen.jpg", type: "" } as File)).toBe(true);
    expect(isImageFile({ name: "bathroom.JPEG", type: "" } as File)).toBe(true);
  });

  it("rejects non-image files", () => {
    expect(
      isImageFile({ name: "notes.pdf", type: "application/pdf" } as File)
    ).toBe(false);
  });
});

describe("registerSessionPhotosFromFiles", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:preview-url"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves previews for the same enquiry ID after registration", () => {
    registerSessionPhotosFromFiles(
      "enquiry-123",
      [
        {
          id: "photo-1",
          name: "kitchen.jpg",
          size: 10,
          type: "image/jpeg",
          imageUrl: null,
          storageKey: null,
          thumbnailUrl: null,
        },
      ],
      [{ name: "kitchen.jpg", type: "" } as File]
    );

    const displays = getEnquiryPhotoDisplaySnapshot("enquiry-123", [
      {
        id: "photo-1",
        name: "kitchen.jpg",
        size: 10,
        type: "image/jpeg",
        imageUrl: null,
        storageKey: null,
        thumbnailUrl: null,
      },
    ]);

    expect(displays[0]?.displayUrl).toBe("blob:preview-url");
  });

  it("does not reuse previews for a different enquiry ID", () => {
    registerSessionPhotosFromFiles(
      "enquiry-a",
      [
        {
          id: "photo-1",
          name: "kitchen.jpg",
          size: 10,
          type: "image/jpeg",
          imageUrl: null,
          storageKey: null,
          thumbnailUrl: null,
        },
      ],
      [{ name: "kitchen.jpg", type: "image/jpeg" } as File]
    );

    const displays = getEnquiryPhotoDisplaySnapshot("enquiry-b", [
      {
        id: "photo-1",
        name: "kitchen.jpg",
        size: 10,
        type: "image/jpeg",
        imageUrl: null,
        storageKey: null,
        thumbnailUrl: null,
      },
    ]);

    expect(displays[0]?.displayUrl).toBeNull();
  });

  it("falls back to null display URLs when previews are missing", () => {
    const displays = getEnquiryPhotoDisplaySnapshot("missing-enquiry", [
      {
        id: "photo-1",
        name: "kitchen.jpg",
        size: 10,
        type: "image/jpeg",
        imageUrl: null,
        storageKey: null,
        thumbnailUrl: null,
      },
    ]);

    expect(displays[0]?.displayUrl).toBeNull();
  });
});
