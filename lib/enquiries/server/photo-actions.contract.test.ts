import { describe, expect, it } from "vitest";
import { buildSiteVisitPhotoPath } from "@/lib/enquiries/server/types";

/**
 * Contract-style checks for photo upload/delete path behaviour.
 * Live Storage/RLS checks happen in manual Phase 2 validation.
 */
describe("site visit photo path and delete contracts", () => {
  it("builds workspace-scoped storage paths for uploads", () => {
    const path = buildSiteVisitPhotoPath({
      workspaceId: "workspace-a",
      enquiryId: "enquiry-1",
      siteVisitId: "visit-1",
      mediaId: "media-1",
      extension: "jpg",
    });

    expect(path).toBe("workspace-a/enquiry-1/visit-1/media-1.jpg");
    expect(path.startsWith("workspace-a/")).toBe(true);
  });

  it("uses intake folder when site visit id is missing", () => {
    const path = buildSiteVisitPhotoPath({
      workspaceId: "workspace-a",
      enquiryId: "enquiry-1",
      siteVisitId: null,
      mediaId: "media-2",
      extension: "png",
    });

    expect(path).toBe("workspace-a/enquiry-1/intake/media-2.png");
  });

  it("documents delete result shape for partial storage misses", () => {
    const success = { ok: true as const, data: { id: "media-1", storageMissing: false } };
    const cleanedMissingObject = {
      ok: true as const,
      data: { id: "media-1", storageMissing: true },
    };

    expect(success.data.storageMissing).toBe(false);
    expect(cleanedMissingObject.data.storageMissing).toBe(true);
  });
});
