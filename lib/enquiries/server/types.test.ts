import { describe, expect, it } from "vitest";
import {
  buildSiteVisitPhotoPath,
  createPublicEnquirySlug,
  mapEnquiryRowToStoredEnquiry,
  mapSiteVisitRowToSession,
  storedEnquiryToInsertPayload,
  type EnquiryRow,
  type SiteVisitRow,
} from "@/lib/enquiries/server/types";
import type { StoredEnquiry } from "@/lib/enquiries/types";

const baseEnquiryRow: EnquiryRow = {
  id: "11111111-1111-1111-1111-111111111111",
  workspace_id: "22222222-2222-2222-2222-222222222222",
  customer_id: null,
  status: "new",
  received_at: "2026-07-25T10:00:00.000Z",
  service_requested: "Boiler repair",
  customer_name: "Sam Customer",
  customer_mobile: "07700900123",
  customer_email: "sam@example.com",
  address_line_1: "1 High Street",
  address_line_2: "",
  town: "Leeds",
  county: "West Yorkshire",
  postcode: "LS1 1AA",
  property_type: "House",
  project_description: "No hot water",
  measurements: [],
  trade_answers: [],
  suggested_next_action: "Review this enquiry",
  linked_proposal_draft_id: null,
  linked_proposal_id: null,
  source: "request_quote",
  archived_at: null,
  created_at: "2026-07-25T10:00:00.000Z",
  updated_at: "2026-07-25T10:00:00.000Z",
};

describe("enquiry server mappers", () => {
  it("maps enquiry rows into the StoredEnquiry shape used by the UI", () => {
    const enquiry = mapEnquiryRowToStoredEnquiry(baseEnquiryRow, {
      timeline: [
        {
          id: "t1",
          workspace_id: baseEnquiryRow.workspace_id,
          enquiry_id: baseEnquiryRow.id,
          label: "Enquiry received",
          event_type: "enquiry_received",
          occurred_at: "2026-07-25T10:00:00.000Z",
          created_by: null,
          created_at: "2026-07-25T10:00:00.000Z",
        },
      ],
      siteVisit: {
        id: "33333333-3333-3333-3333-333333333333",
        workspace_id: baseEnquiryRow.workspace_id,
        enquiry_id: baseEnquiryRow.id,
        slot_label: "Tue 10:00",
        starts_at: "2026-07-28T09:00:00.000Z",
        date_iso: "2026-07-28",
        started_at: null,
        completed_at: null,
        notes: "",
        measurements: [],
        checklist: [],
        voice_notes: [],
        created_at: "2026-07-25T10:00:00.000Z",
        updated_at: "2026-07-25T10:00:00.000Z",
      },
      workspace: {
        businessName: "Smith Plumbing",
        phone: "07700900456",
        contactEmail: "shop@example.com",
      },
    });

    expect(enquiry.customerName).toBe("Sam Customer");
    expect(enquiry.city).toBe("Leeds");
    expect(enquiry.siteVisitSlot).toBe("Tue 10:00");
    expect(enquiry.timeline).toHaveLength(1);
    expect(enquiry.tradespersonBusiness).toBe("Smith Plumbing");
  });

  it("maps site visit rows into SiteVisitSession", () => {
    const row: SiteVisitRow = {
      id: "33333333-3333-3333-3333-333333333333",
      workspace_id: baseEnquiryRow.workspace_id,
      enquiry_id: baseEnquiryRow.id,
      slot_label: null,
      starts_at: null,
      date_iso: null,
      started_at: "2026-07-25T11:00:00.000Z",
      completed_at: null,
      notes: "Access via side gate",
      measurements: [{ id: "m1", label: "Width", unit: "m", value: "2" }],
      checklist: [{ id: "c1", label: "Photos", checked: true }],
      voice_notes: [],
      created_at: "2026-07-25T11:00:00.000Z",
      updated_at: "2026-07-25T11:00:00.000Z",
    };

    const session = mapSiteVisitRowToSession(row);
    expect(session.enquiryId).toBe(baseEnquiryRow.id);
    expect(session.notes).toBe("Access via side gate");
    expect(session.measurements).toHaveLength(1);
    expect(session.checklist[0]?.checked).toBe(true);
  });

  it("builds workspace-scoped storage paths without trusting the original filename", () => {
    const path = buildSiteVisitPhotoPath({
      workspaceId: "ws",
      enquiryId: "en",
      siteVisitId: "sv",
      mediaId: "media-1",
      extension: ".JPG",
    });
    expect(path).toBe("ws/en/sv/media-1.jpg");
  });

  it("creates public enquiry slugs with a stable prefix", () => {
    const slug = createPublicEnquirySlug();
    expect(slug.startsWith("qf")).toBe(true);
    expect(slug.length).toBeGreaterThan(8);
  });

  it("preserves enquiry ids when preparing a local migration insert", () => {
    const stored: StoredEnquiry = {
      id: baseEnquiryRow.id,
      status: "reviewing",
      receivedAt: baseEnquiryRow.received_at,
      customerName: "Sam Customer",
      customerMobile: "07700900123",
      customerEmail: "sam@example.com",
      serviceRequested: "Boiler repair",
      addressLine1: "1 High Street",
      addressLine2: "",
      city: "Leeds",
      county: "West Yorkshire",
      postcode: "LS1 1AA",
      propertyType: "House",
      projectDescription: "No hot water",
      photoCount: 0,
      photos: [],
      hasMeasurements: false,
      measurements: [],
      tradeAnswers: [],
      tradespersonBusiness: "Smith Plumbing",
      tradespersonPhone: "",
      tradespersonEmail: "",
      suggestedNextAction: "Ask a question",
      siteVisitSlot: null,
      siteVisitStartsAt: null,
      linkedProposalDraftId: null,
      timeline: [],
    };

    const payload = storedEnquiryToInsertPayload(
      stored,
      baseEnquiryRow.workspace_id
    );
    expect(payload.id).toBe(baseEnquiryRow.id);
    expect(payload.source).toBe("local_migration");
    expect(payload.town).toBe("Leeds");
  });
});
