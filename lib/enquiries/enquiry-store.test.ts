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
