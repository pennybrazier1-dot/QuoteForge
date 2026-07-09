import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SESSIONS_KEY = "quoteforge:site-visit-sessions";
const ENQUIRIES_KEY = "quoteforge:enquiries";

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

function sampleEnquiry() {
  return {
    id: "enquiry-1",
    status: "site_visit_booked",
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
    photoCount: 0,
    photos: [],
    hasMeasurements: false,
    measurements: [],
    tradeAnswers: [],
    tradespersonBusiness: "John's Plumbing",
    tradespersonPhone: "07700 900 456",
    tradespersonEmail: "",
    suggestedNextAction: "Confirm the visit",
    siteVisitSlot: "Thursday 09:30",
    siteVisitStartsAt: "2026-07-10T08:30:00.000Z",
    timeline: [],
  };
}

describe("site visit session store", () => {
  let localStorage = createLocalStorageMock();

  beforeEach(() => {
    localStorage = createLocalStorageMock();
    vi.stubGlobal("window", {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("voice-note-1")
        .mockReturnValueOnce("photo-1")
        .mockReturnValueOnce("timeline-1")
        .mockReturnValueOnce("timeline-2")
        .mockReturnValueOnce("timeline-3"),
    });
    localStorage.setItem(ENQUIRIES_KEY, JSON.stringify([sampleEnquiry()]));
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a session and records timeline events for actions", async () => {
    const {
      ensureSiteVisitSession,
      addSiteVisitVoiceNote,
      addSiteVisitPhoto,
      getSiteVisitSession,
    } = await import("@/lib/site-visit/site-visit-session-store");
    const { getStoredEnquiry } = await import("@/lib/enquiries/enquiry-store");

    ensureSiteVisitSession("enquiry-1");
    addSiteVisitVoiceNote("enquiry-1");
    addSiteVisitPhoto("enquiry-1", "kitchen.jpg");

    const session = getSiteVisitSession("enquiry-1");
    expect(session?.voiceNotes).toHaveLength(1);
    expect(session?.photos).toHaveLength(1);
    expect(getStoredEnquiry("enquiry-1")?.timeline.map((event) => event.label)).toEqual(
      expect.arrayContaining([
        "Site visit started.",
        "Voice note captured on site.",
        "Site visit photo added.",
      ])
    );
  });

  it("completes a site visit and updates enquiry status", async () => {
    const { ensureSiteVisitSession } = await import(
      "@/lib/site-visit/site-visit-session-store"
    );
    const { completeSiteVisit, getStoredEnquiry } = await import(
      "@/lib/enquiries/enquiry-store"
    );

    ensureSiteVisitSession("enquiry-1");
    const updated = completeSiteVisit("enquiry-1");

    expect(updated?.status).toBe("site_visit_completed");
    expect(getStoredEnquiry("enquiry-1")?.timeline[0]?.label).toBe(
      "Site visit completed."
    );
    expect(localStorage.getItem(SESSIONS_KEY)).toContain("completedAt");
  });
});
