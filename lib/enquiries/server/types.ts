import type { MeasurementField } from "@/lib/customer-journey/types";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import type {
  EnquiryStatus,
  EnquiryTimelineEvent,
  EnquiryTradeAnswer,
  StoredEnquiry,
} from "@/lib/enquiries/types";
import type {
  SiteVisitChecklistItem,
  SiteVisitMeasurement,
  SiteVisitSession,
  SiteVisitVoiceNote,
} from "@/lib/site-visit/types";

export type EnquiryRow = {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  status: EnquiryStatus;
  received_at: string;
  service_requested: string;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  property_type: string | null;
  project_description: string;
  measurements: MeasurementField[] | null;
  trade_answers: EnquiryTradeAnswer[] | null;
  suggested_next_action: string;
  linked_proposal_draft_id: string | null;
  linked_proposal_id: string | null;
  source: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EnquiryTimelineRow = {
  id: string;
  workspace_id: string;
  enquiry_id: string;
  label: string;
  event_type: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
};

export type SiteVisitRow = {
  id: string;
  workspace_id: string;
  enquiry_id: string;
  slot_label: string | null;
  starts_at: string | null;
  date_iso: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string;
  measurements: SiteVisitMeasurement[] | null;
  checklist: SiteVisitChecklistItem[] | null;
  voice_notes: SiteVisitVoiceNote[] | null;
  created_at: string;
  updated_at: string;
};

export type EnquiryMediaRow = {
  id: string;
  workspace_id: string;
  enquiry_id: string;
  site_visit_id: string | null;
  kind: "photo" | "voice_note";
  file_name: string;
  mime_type: string;
  byte_size: number;
  storage_path: string;
  captured_at: string;
  sort_order: number;
  created_at: string;
};

export type WorkspacePublicIntake = {
  workspaceId: string;
  businessName: string;
  phone: string | null;
  contactEmail: string | null;
  tradeType: string | null;
  publicEnquirySlug: string;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function mapTimelineRows(
  rows: EnquiryTimelineRow[] | null | undefined
): EnquiryTimelineEvent[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    at: row.occurred_at,
  }));
}

export function mapMediaRowsToPhotos(
  rows: EnquiryMediaRow[] | null | undefined
): EnquiryPhotoReference[] {
  return (rows ?? [])
    .filter((row) => row.kind === "photo")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      id: row.id,
      name: row.file_name || "photo.jpg",
      size: Number(row.byte_size) || 0,
      type: row.mime_type || "image/jpeg",
      imageUrl: null,
      storageKey: row.storage_path,
      thumbnailUrl: null,
    }));
}

export function mapEnquiryRowToStoredEnquiry(
  row: EnquiryRow,
  options: {
    timeline?: EnquiryTimelineRow[] | null;
    photos?: EnquiryMediaRow[] | null;
    siteVisit?: SiteVisitRow | null;
    workspace?: {
      businessName?: string | null;
      phone?: string | null;
      contactEmail?: string | null;
    } | null;
  } = {}
): StoredEnquiry {
  const photos = mapMediaRowsToPhotos(options.photos);
  const measurements = asArray<MeasurementField>(row.measurements);
  const siteVisit = options.siteVisit ?? null;

  return {
    id: row.id,
    status: row.status,
    receivedAt: row.received_at,
    customerName: row.customer_name,
    customerMobile: row.customer_mobile,
    customerEmail: row.customer_email,
    serviceRequested: row.service_requested,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.town,
    county: row.county,
    postcode: row.postcode,
    propertyType: row.property_type,
    projectDescription: row.project_description,
    photoCount: photos.length,
    photos,
    hasMeasurements: measurements.some((field) => field.value?.trim()),
    measurements,
    tradeAnswers: asArray<EnquiryTradeAnswer>(row.trade_answers),
    tradespersonBusiness: options.workspace?.businessName?.trim() || "Your business",
    tradespersonPhone: options.workspace?.phone?.trim() || "",
    tradespersonEmail: options.workspace?.contactEmail?.trim() || "",
    suggestedNextAction: row.suggested_next_action,
    siteVisitSlot: siteVisit?.slot_label ?? null,
    siteVisitStartsAt: siteVisit?.starts_at ?? null,
    linkedProposalDraftId: row.linked_proposal_draft_id,
    timeline: mapTimelineRows(options.timeline),
  };
}

export function mapSiteVisitRowToSession(
  row: SiteVisitRow,
  photos: EnquiryMediaRow[] = []
): SiteVisitSession {
  return {
    enquiryId: row.enquiry_id,
    startedAt: row.started_at ?? row.created_at,
    completedAt: row.completed_at,
    voiceNotes: asArray<SiteVisitVoiceNote>(row.voice_notes),
    photos: photos
      .filter((photo) => photo.kind === "photo")
      .map((photo) => ({
        id: photo.id,
        name: photo.file_name || "photo.jpg",
        capturedAt: photo.captured_at,
      })),
    measurements: asArray<SiteVisitMeasurement>(row.measurements),
    notes: row.notes ?? "",
    checklist: asArray<SiteVisitChecklistItem>(row.checklist),
  };
}

export function storedEnquiryToInsertPayload(
  enquiry: StoredEnquiry,
  workspaceId: string
): Omit<EnquiryRow, "created_at" | "updated_at" | "archived_at" | "linked_proposal_id" | "customer_id" | "source"> & {
  workspace_id: string;
  source: string;
  customer_id: null;
  linked_proposal_id: null;
  archived_at: null;
} {
  return {
    id: enquiry.id,
    workspace_id: workspaceId,
    customer_id: null,
    status: enquiry.status,
    received_at: enquiry.receivedAt,
    service_requested: enquiry.serviceRequested,
    customer_name: enquiry.customerName,
    customer_mobile: enquiry.customerMobile,
    customer_email: enquiry.customerEmail,
    address_line_1: enquiry.addressLine1,
    address_line_2: enquiry.addressLine2,
    town: enquiry.city,
    county: enquiry.county,
    postcode: enquiry.postcode,
    property_type: enquiry.propertyType,
    project_description: enquiry.projectDescription,
    measurements: enquiry.measurements,
    trade_answers: enquiry.tradeAnswers,
    suggested_next_action: enquiry.suggestedNextAction,
    linked_proposal_draft_id: enquiry.linkedProposalDraftId,
    linked_proposal_id: null,
    source: "local_migration",
    archived_at: null,
  };
}

export function createPublicEnquirySlug(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let slug = "qf";
  for (const byte of bytes) {
    slug += alphabet[byte % alphabet.length];
  }
  return slug;
}

export const SITE_VISIT_PHOTOS_BUCKET = "site-visit-photos";

export function buildSiteVisitPhotoPath(options: {
  workspaceId: string;
  enquiryId: string;
  siteVisitId: string | null;
  mediaId: string;
  extension: string;
}): string {
  const folder = options.siteVisitId ?? "intake";
  const ext = options.extension.replace(/^\./, "").toLowerCase() || "jpg";
  return `${options.workspaceId}/${options.enquiryId}/${folder}/${options.mediaId}.${ext}`;
}
