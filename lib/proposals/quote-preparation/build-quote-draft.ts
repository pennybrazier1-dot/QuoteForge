import { formatEnquiryAddress } from "@/lib/enquiries/format";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import {
  QUOTE_PREPARATION_REVIEW_NOTICE,
  type QuoteLineItem,
  type QuoteMaterialItem,
  type QuotePreparationDraft,
} from "@/lib/proposals/quote-preparation/types";
import type { SiteVisitSession } from "@/lib/site-visit/types";

function createLineItem(description: string): QuoteLineItem {
  return {
    id: crypto.randomUUID(),
    description,
    quantity: "",
    rate: "",
    lineTotal: "",
  };
}

function createSuggestedMaterial(description: string): QuoteMaterialItem {
  return {
    id: crypto.randomUUID(),
    description: `Draft suggestion: ${description}`,
    suggested: true,
    price: "",
  };
}

function formatSiteVisitDate(enquiry: StoredEnquiry): string {
  if (enquiry.siteVisitStartsAt) {
    const date = new Date(enquiry.siteVisitStartsAt);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
  }

  return enquiry.siteVisitSlot?.trim() || "Date to be confirmed";
}

function formatMeasurements(
  enquiry: StoredEnquiry,
  session: SiteVisitSession | null
): string {
  const lines: string[] = [];

  for (const field of session?.measurements ?? []) {
    if (field.value.trim()) {
      lines.push(`${field.label}: ${field.value.trim()}${field.unit ? ` ${field.unit}` : ""}`);
    }
  }

  for (const field of enquiry.measurements ?? []) {
    if (field.value?.trim()) {
      const label = field.label?.trim() || "Measurement";
      lines.push(`${label}: ${field.value.trim()}${field.unit ? ` ${field.unit}` : ""}`);
    }
  }

  return lines.join("\n");
}

function formatVoiceNoteTranscripts(session: SiteVisitSession | null): string {
  const notes = session?.voiceNotes;
  if (!Array.isArray(notes) || notes.length === 0) {
    return "";
  }

  return notes
    .map((note) => `${note.label} (placeholder transcript — review on site).`)
    .join("\n");
}

function buildScopeItems(enquiry: StoredEnquiry): string[] {
  const items: string[] = [];

  if (enquiry.serviceRequested.trim()) {
    items.push(enquiry.serviceRequested.trim());
  }

  if (enquiry.projectDescription.trim()) {
    const sentences = enquiry.projectDescription
      .split(/[.!?]\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (sentences.length > 1) {
      items.push(...sentences);
    }
  }

  for (const answer of enquiry.tradeAnswers ?? []) {
    if (answer.question?.trim() && answer.answer?.trim()) {
      items.push(`${answer.question}: ${answer.answer.trim()}`);
    }
  }

  return items.length > 0 ? items : ["Scope to be confirmed from site visit notes."];
}

function buildSiteDetails(
  enquiry: StoredEnquiry,
  session: SiteVisitSession | null
): string[] {
  const details: string[] = [];

  if (enquiry.propertyType?.trim()) {
    details.push(`Property type: ${enquiry.propertyType.trim()}`);
  }

  if (session?.notes.trim()) {
    details.push(`Visit notes: ${session.notes.trim()}`);
  }

  const checked = (session?.checklist ?? []).filter((item) => item.checked);
  for (const item of checked) {
    details.push(`Checklist: ${item.label}`);
  }

  const unchecked = (session?.checklist ?? []).filter((item) => !item.checked);
  for (const item of unchecked) {
    details.push(`To confirm: ${item.label}`);
  }

  const sessionPhotoCount = Array.isArray(session?.photos)
    ? session.photos.length
    : 0;

  if (sessionPhotoCount > 0 || enquiry.photoCount > 0) {
    const count = sessionPhotoCount || enquiry.photoCount;
    details.push(`${count} site photo reference${count === 1 ? "" : "s"} captured.`);
  }

  return details;
}

function buildMaterialSuggestions(enquiry: StoredEnquiry): QuoteMaterialItem[] {
  const service = enquiry.serviceRequested.trim() || "job";
  return [
    createSuggestedMaterial(`${service} materials — prices to be confirmed`),
    createSuggestedMaterial("Fixings and consumables — prices to be confirmed"),
  ];
}

function buildJobDescription(
  enquiry: StoredEnquiry,
  session: SiteVisitSession | null
): string {
  return [
    enquiry.projectDescription.trim()
      ? `Original enquiry:\n${enquiry.projectDescription.trim()}`
      : "",
    session?.notes.trim() ? `Site visit notes:\n${session.notes.trim()}` : "",
    formatVoiceNoteTranscripts(session)
      ? `Voice notes:\n${formatVoiceNoteTranscripts(session)}`
      : "",
    formatMeasurements(enquiry, session)
      ? `Measurements:\n${formatMeasurements(enquiry, session)}`
      : "",
    enquiry.tradeAnswers?.length
      ? `Trade answers:\n${enquiry.tradeAnswers
          .map((answer) => `${answer.question}: ${answer.answer}`)
          .join("\n")}`
      : "",
    `Site visit date: ${formatSiteVisitDate(enquiry)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildThingsToConfirm(
  enquiry: StoredEnquiry,
  session: SiteVisitSession | null
): string[] {
  const items = [
    "Labour estimate",
    "Material prices",
    "VAT treatment",
    "Start date or timescale",
  ];

  const hasMeasurements = formatMeasurements(enquiry, session).length > 0;
  if (!hasMeasurements) {
    items.push("Any missing measurements");
  }

  return items;
}

export function buildQuotePreparationDraft(
  enquiry: StoredEnquiry,
  session: SiteVisitSession | null
): QuotePreparationDraft {
  const scopeItems = buildScopeItems(enquiry);
  const measurementsText = formatMeasurements(enquiry, session);

  return {
    enquiryId: enquiry.id,
    siteVisitSessionId: session ? enquiry.id : null,
    customerId: null,
    sourceType: "site-visit",
    reviewNotice: QUOTE_PREPARATION_REVIEW_NOTICE,
    customerName: enquiry.customerName.trim() || "Customer",
    propertyAddress: formatEnquiryAddress(enquiry) || "",
    phoneNumber: enquiry.customerMobile.trim(),
    emailAddress: enquiry.customerEmail.trim(),
    jobDescription: buildJobDescription(enquiry, session),
    scopeSummary:
      enquiry.projectDescription.trim() ||
      enquiry.serviceRequested.trim() ||
      "Work requested during the site visit.",
    scopeItems,
    siteDetails: buildSiteDetails(enquiry, session),
    measurementsText,
    materials: buildMaterialSuggestions(enquiry),
    labourItems: [createLineItem("On-site labour — enter time and rate")],
    additionalCosts: [
      createLineItem("Waste removal"),
      createLineItem("Delivery"),
      createLineItem("Equipment hire"),
      createLineItem("Other expenses"),
    ],
    notesAndExclusions:
      "Please confirm customer requirements, access arrangements, and any work not included before sending.",
    assumptions: [
      "Normal working hours unless agreed otherwise.",
      "Existing services are in safe working order unless noted on site.",
    ],
    thingsToConfirm: buildThingsToConfirm(enquiry, session),
    validityPeriod: "30 days from quote date",
    expectedTimescale: "",
    vatEnabled: false,
    vatRate: "20",
    subtotal: "",
    vatAmount: "",
    total: "",
    estimatedDuration: "",
    plannedStartDateText: "",
    plannedStartDateExact: "",
    photoCount: Array.isArray(session?.photos)
      ? session.photos.length
      : enquiry.photoCount ?? 0,
    siteVisitDate: formatSiteVisitDate(enquiry),
  };
}

export function buildQuotePreparationDraftSafe(
  enquiry: StoredEnquiry | null | undefined,
  session: SiteVisitSession | null | undefined
): QuotePreparationDraft | null {
  if (!enquiry?.id) {
    return null;
  }

  try {
    return buildQuotePreparationDraft(enquiry, session ?? null);
  } catch {
    return buildQuotePreparationDraft(
      {
        ...enquiry,
        customerName: enquiry.customerName || "Customer",
        projectDescription: enquiry.projectDescription || "",
        serviceRequested: enquiry.serviceRequested || "Site visit work",
        tradeAnswers: Array.isArray(enquiry.tradeAnswers) ? enquiry.tradeAnswers : [],
        measurements: Array.isArray(enquiry.measurements) ? enquiry.measurements : [],
        photoCount: enquiry.photoCount ?? 0,
      },
      null
    );
  }
}
