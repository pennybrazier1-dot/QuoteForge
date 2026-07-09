import { describe, expect, it } from "vitest";
import {
  enquiryRecordHadBinaryPhotoData,
  normalizeEnquiry,
  parseStoredEnquiries,
} from "@/lib/enquiries/normalize-enquiry";
import { getEnquiryPhotoDisplaySnapshot } from "@/lib/enquiries/photo-session-store";

describe("normalizeEnquiry", () => {
  it("normalizes legacy enquiries with base64 photoPreviews", () => {
    const enquiry = normalizeEnquiry({
      id: "legacy-1",
      status: "new",
      receivedAt: "2026-07-09T10:00:00.000Z",
      customerName: "Sarah Johnson",
      photoCount: 2,
      photoPreviews: [
        {
          id: "photo-1",
          name: "kitchen.jpg",
          dataUrl: "data:image/jpeg;base64,VERY_LARGE_LEGACY_PAYLOAD",
        },
        {
          name: "bathroom.jpg",
          dataUrl: "data:image/jpeg;base64,ANOTHER_LEGACY_PAYLOAD",
        },
      ],
    });

    expect(enquiry).not.toBeNull();
    expect(enquiry?.photoCount).toBe(2);
    expect(enquiry?.photos).toHaveLength(2);
    expect(enquiry?.photos[0]).not.toHaveProperty("dataUrl");
    expect(enquiry?.photos[0]?.imageUrl).toBeNull();
    expect(enquiry?.photos[1]?.id).toBe("legacy-photo-1");
  });

  it("drops malformed enquiry records without crashing", () => {
    const enquiries = parseStoredEnquiries(
      JSON.stringify([
        null,
        "not-an-enquiry",
        { id: "missing-received-at" },
        {
          id: "valid-1",
          receivedAt: "2026-07-09T10:00:00.000Z",
          status: "not-a-real-status",
          photoCount: 3,
          photos: null,
          timeline: [{ label: "Enquiry received" }],
          measurements: [{ value: "3m" }],
        },
      ])
    );

    expect(enquiries.enquiries).toHaveLength(1);
    expect(enquiries.enquiries[0]).toMatchObject({
      id: "valid-1",
      status: "new",
      photoCount: 3,
      photos: [],
    });
    expect(enquiries.enquiries[0]?.timeline[0]?.label).toBe("Enquiry received");
  });

  it("flags localStorage records that still contain legacy binary photo data", () => {
    expect(
      enquiryRecordHadBinaryPhotoData({
        photoPreviews: [{ id: "p1", dataUrl: "data:image/jpeg;base64,abc" }],
      })
    ).toBe(true);

    expect(
      enquiryRecordHadBinaryPhotoData({
        photos: [{ id: "p1", name: "kitchen.jpg", size: 10, type: "image/jpeg" }],
      })
    ).toBe(false);
  });

  it("parses corrupt localStorage as an empty list", () => {
    const result = parseStoredEnquiries("{not valid json");

    expect(result.enquiries).toEqual([]);
    expect(result.needsMigration).toBe(false);
  });

  it("requests migration when legacy binary photos are removed during parse", () => {
    const result = parseStoredEnquiries(
      JSON.stringify([
        {
          id: "legacy-2",
          receivedAt: "2026-07-09T11:00:00.000Z",
          status: "reviewing",
          photoPreviews: [
            {
              id: "photo-1",
              name: "kitchen.jpg",
              dataUrl: "data:image/jpeg;base64,LEGACY",
            },
          ],
        },
      ])
    );

    expect(result.needsMigration).toBe(true);
    expect(result.enquiries[0]?.photos[0]).toEqual(
      expect.objectContaining({
        id: "photo-1",
        name: "kitchen.jpg",
      })
    );
  });
});

describe("getEnquiryPhotoDisplaySnapshot", () => {
  it("returns independent snapshots for different enquiries", () => {
    const first = getEnquiryPhotoDisplaySnapshot("enquiry-a", [
      {
        id: "photo-a",
        name: "A.jpg",
        size: 1,
        type: "image/jpeg",
        imageUrl: "https://example.com/a.jpg",
      },
    ]);
    const second = getEnquiryPhotoDisplaySnapshot("enquiry-b", [
      {
        id: "photo-b",
        name: "B.jpg",
        size: 1,
        type: "image/jpeg",
        imageUrl: "https://example.com/b.jpg",
      },
    ]);

    expect(first[0]?.displayUrl).toBe("https://example.com/a.jpg");
    expect(second[0]?.displayUrl).toBe("https://example.com/b.jpg");
    expect(first).not.toBe(second);
  });

  it("never uses legacy data URLs as display URLs", () => {
    const displays = getEnquiryPhotoDisplaySnapshot("enquiry-c", [
      {
        id: "photo-c",
        name: "legacy.jpg",
        size: 1,
        type: "image/jpeg",
        imageUrl: "data:image/jpeg;base64,legacy",
      },
    ]);

    expect(displays[0]?.displayUrl).toBeNull();
  });
});
