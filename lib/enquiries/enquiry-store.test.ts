import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "quoteforge:enquiries";

function createLocalStorageMock() {
  const storage = new Map<string, string>();

  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
}

function seedLocalStorage(value: unknown, localStorage: ReturnType<typeof createLocalStorageMock>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function sampleEnquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: "enquiry-1",
    status: "new",
    receivedAt: "2026-07-09T12:00:00.000Z",
    customerName: "Jane Smith",
    customerMobile: "07700 900123",
    customerEmail: "jane@example.com",
    serviceRequested: "Plumbing",
    addressLine1: "12 Oak Street",
    addressLine2: "",
    city: "Northampton",
    county: "Northamptonshire",
    postcode: "NN1 1AA",
    propertyType: "House",
    projectDescription: "Fix a leak",
    photoCount: 1,
    photos: [
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
    hasMeasurements: false,
    measurements: [],
    tradeAnswers: [],
    tradespersonBusiness: "John's Plumbing",
    suggestedNextAction: "Review the enquiry",
    siteVisitSlot: null,
    timeline: [
      {
        id: "timeline-1",
        label: "Enquiry received",
        at: "2026-07-09T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("getStoredEnquiries with legacy localStorage data", () => {
  let localStorage = createLocalStorageMock();

  beforeEach(async () => {
    localStorage = createLocalStorageMock();
    vi.stubGlobal("window", {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadStore() {
    return import("@/lib/enquiries/enquiry-store");
  }

  it("loads enquiries with legacy base64 photoPreviews without crashing", async () => {
    const { getStoredEnquiries } = await loadStore();

    seedLocalStorage(
      [
        {
          id: "legacy-enquiry-1",
          status: "new",
          receivedAt: "2026-07-09T10:00:00.000Z",
          customerName: "Sarah Johnson",
          photoCount: 2,
          photoPreviews: [
            {
              id: "photo-1",
              name: "kitchen.jpg",
              dataUrl: "data:image/jpeg;base64,LEGACY_BINARY",
            },
            {
              id: "photo-2",
              name: "bathroom.jpg",
              dataUrl: "data:image/jpeg;base64,MORE_LEGACY_BINARY",
            },
          ],
          timeline: [
            { id: "t1", label: "Enquiry received", at: "2026-07-09T10:00:00.000Z" },
          ],
        },
        {
          id: "legacy-enquiry-2",
          status: "reviewing",
          receivedAt: "2026-07-08T09:00:00.000Z",
          customerName: "James Smith",
          photos: null,
          photoCount: 3,
          timeline: [],
        },
      ],
      localStorage
    );

    const enquiries = getStoredEnquiries();

    expect(enquiries).toHaveLength(2);
    expect(enquiries[0]?.id).toBe("legacy-enquiry-1");
    expect(enquiries[0]?.photos).toHaveLength(2);
    expect(enquiries[0]?.photos[0]).not.toHaveProperty("dataUrl");
    expect(enquiries[1]?.photos).toEqual([]);
    expect(enquiries[1]?.photoCount).toBe(3);
  });

  it("returns an empty list when localStorage contains corrupt JSON", async () => {
    const { getStoredEnquiries } = await loadStore();

    localStorage.setItem(STORAGE_KEY, "{broken json");

    expect(getStoredEnquiries()).toEqual([]);
  });

  it("drops malformed records but keeps valid enquiries", async () => {
    const { getStoredEnquiries } = await loadStore();

    seedLocalStorage(
      [
        null,
        { id: "missing-date" },
        {
          id: "valid-enquiry",
          receivedAt: "2026-07-09T12:00:00.000Z",
          status: "new",
          photos: [{ id: "p1", name: "roof.jpg", dataUrl: "data:image/jpeg;base64,x" }],
          photoCount: 1,
        },
      ],
      localStorage
    );

    const enquiries = getStoredEnquiries();

    expect(enquiries).toHaveLength(1);
    expect(enquiries[0]?.id).toBe("valid-enquiry");
    expect(enquiries[0]?.photos[0]?.name).toBe("roof.jpg");
  });

  it("clears local test enquiries from localStorage", async () => {
    const { clearLocalTestEnquiries, getStoredEnquiries } = await loadStore();

    seedLocalStorage(
      [
        {
          id: "to-clear",
          receivedAt: "2026-07-09T12:00:00.000Z",
          status: "new",
        },
      ],
      localStorage
    );

    expect(getStoredEnquiries()).toHaveLength(1);

    clearLocalTestEnquiries();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getStoredEnquiries()).toEqual([]);
  });
});

describe("enquiry workflow actions", () => {
  let localStorage = createLocalStorageMock();

  beforeEach(async () => {
    localStorage = createLocalStorageMock();
    vi.stubGlobal("window", {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadStore() {
    return import("@/lib/enquiries/enquiry-store");
  }

  it("decline changes enquiry status to Declined", async () => {
    const { declineStoredEnquiry, getStoredEnquiry } = await loadStore();

    seedLocalStorage([sampleEnquiry()], localStorage);

    const updated = declineStoredEnquiry("enquiry-1");

    expect(updated?.status).toBe("declined");
    expect(getStoredEnquiry("enquiry-1")?.status).toBe("declined");
    expect(getStoredEnquiry("enquiry-1")?.timeline[0]?.label).toBe(
      "Enquiry declined"
    );
  });

  it("delete removes enquiry from local storage", async () => {
    const { deleteStoredEnquiry, getStoredEnquiries } = await loadStore();

    seedLocalStorage([sampleEnquiry()], localStorage);

    expect(getStoredEnquiries()).toHaveLength(1);

    const deleted = await deleteStoredEnquiry("enquiry-1");

    expect(deleted).toBe(true);
    expect(getStoredEnquiries()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
  });

  it("deleted enquiry no longer appears in the stored list", async () => {
    const { deleteStoredEnquiry, getStoredEnquiries } = await loadStore();

    seedLocalStorage(
      [
        sampleEnquiry({ id: "enquiry-1", customerName: "Jane Smith" }),
        sampleEnquiry({ id: "enquiry-2", customerName: "Alex Jones" }),
      ],
      localStorage
    );

    await deleteStoredEnquiry("enquiry-1");

    expect(getStoredEnquiries()).toHaveLength(1);
    expect(getStoredEnquiries()[0]?.id).toBe("enquiry-2");
  });
});
