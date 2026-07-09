import type {
  EnquiryStatus,
  EnquiryTimelineEvent,
  EnquiryTradeAnswer,
  StoredEnquiry,
} from "@/lib/enquiries/types";
import type { MeasurementField } from "@/lib/customer-journey/types";
import {
  normalizePhotoReference,
  type EnquiryPhotoReference,
} from "@/lib/enquiries/photo-metadata";

const VALID_STATUSES: EnquiryStatus[] = [
  "new",
  "reviewing",
  "site_visit_booked",
  "declined",
];

export function stripLegacyBinaryPhotoFields(photos: unknown): unknown[] {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos.map((photo) => {
    if (!photo || typeof photo !== "object") {
      return photo;
    }

    const rest = { ...(photo as Record<string, unknown>) };
    delete rest.dataUrl;
    return rest;
  });
}

export function stripBinaryFieldsFromEnquiryRecord(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const raw = value as Record<string, unknown>;
  const next: Record<string, unknown> = { ...raw };

  if ("photos" in raw) {
    next.photos = stripLegacyBinaryPhotoFields(raw.photos);
  }

  if ("photoPreviews" in raw) {
    next.photoPreviews = stripLegacyBinaryPhotoFields(raw.photoPreviews);
  }

  return next;
}

export function enquiryRecordHadBinaryPhotoData(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const raw = value as Record<string, unknown>;
  const sources = [raw.photos, raw.photoPreviews];

  return sources.some((photos) => {
    if (!Array.isArray(photos)) {
      return false;
    }

    return photos.some(
      (photo) =>
        Boolean(photo) &&
        typeof photo === "object" &&
        typeof (photo as { dataUrl?: unknown }).dataUrl === "string" &&
        (photo as { dataUrl: string }).dataUrl.length > 0
    );
  });
}

function normalizeStatus(value: unknown): EnquiryStatus {
  if (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as EnquiryStatus)
  ) {
    return value as EnquiryStatus;
  }

  return "new";
}

function normalizeTimeline(value: unknown): EnquiryTimelineEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const event = item as Partial<EnquiryTimelineEvent>;
    const label =
      typeof event.label === "string" && event.label.trim()
        ? event.label.trim()
        : "Update";

    return [
      {
        id:
          typeof event.id === "string" && event.id.trim()
            ? event.id
            : `timeline-${index}`,
        label,
        at:
          typeof event.at === "string" && event.at.trim()
            ? event.at
            : new Date(0).toISOString(),
      },
    ];
  });
}

function normalizeMeasurements(value: unknown): MeasurementField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const field = item as Partial<MeasurementField>;

    return [
      {
        id:
          typeof field.id === "string" && field.id.trim()
            ? field.id
            : `measurement-${index}`,
        label: typeof field.label === "string" ? field.label : "Measurement",
        value: typeof field.value === "string" ? field.value : "",
        unit: typeof field.unit === "string" ? field.unit : "",
      },
    ];
  });
}

function normalizeTradeAnswers(value: unknown): EnquiryTradeAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const answer = item as Partial<EnquiryTradeAnswer>;

    if (
      typeof answer.questionId !== "string" ||
      typeof answer.question !== "string" ||
      typeof answer.answer !== "string"
    ) {
      return [];
    }

    return [
      {
        questionId: answer.questionId,
        question: answer.question,
        answer: answer.answer,
      },
    ];
  });
}

export function normalizeStoredPhotos(
  raw: Record<string, unknown>
): EnquiryPhotoReference[] {
  const source = Array.isArray(raw.photos)
    ? raw.photos
    : Array.isArray(raw.photoPreviews)
      ? raw.photoPreviews
      : [];

  return stripLegacyBinaryPhotoFields(source)
    .map((photo, index) =>
      normalizePhotoReference(photo, { fallbackId: `legacy-photo-${index}` })
    )
    .filter((photo): photo is EnquiryPhotoReference => photo !== null);
}

export function normalizeEnquiry(value: unknown): StoredEnquiry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = stripBinaryFieldsFromEnquiryRecord(value) as Record<string, unknown>;

  if (
    typeof raw.id !== "string" ||
    typeof raw.receivedAt !== "string" ||
    !raw.receivedAt.trim()
  ) {
    return null;
  }

  const photos = normalizeStoredPhotos(raw);
  const photoCount = Math.max(
    typeof raw.photoCount === "number" && Number.isFinite(raw.photoCount)
      ? raw.photoCount
      : 0,
    photos.length
  );

  return {
    id: raw.id,
    status: normalizeStatus(raw.status),
    receivedAt: raw.receivedAt,
    customerName:
      typeof raw.customerName === "string" ? raw.customerName : "",
    customerMobile:
      typeof raw.customerMobile === "string" ? raw.customerMobile : "",
    customerEmail:
      typeof raw.customerEmail === "string" ? raw.customerEmail : "",
    serviceRequested:
      typeof raw.serviceRequested === "string" ? raw.serviceRequested : "",
    addressLine1:
      typeof raw.addressLine1 === "string" ? raw.addressLine1 : "",
    addressLine2:
      typeof raw.addressLine2 === "string" ? raw.addressLine2 : "",
    city: typeof raw.city === "string" ? raw.city : "",
    postcode: typeof raw.postcode === "string" ? raw.postcode : "",
    propertyType:
      typeof raw.propertyType === "string" ? raw.propertyType : null,
    projectDescription:
      typeof raw.projectDescription === "string" ? raw.projectDescription : "",
    photoCount,
    photos,
    hasMeasurements: Boolean(raw.hasMeasurements),
    measurements: normalizeMeasurements(raw.measurements),
    tradeAnswers: normalizeTradeAnswers(raw.tradeAnswers),
    tradespersonBusiness:
      typeof raw.tradespersonBusiness === "string"
        ? raw.tradespersonBusiness
        : "",
    suggestedNextAction:
      typeof raw.suggestedNextAction === "string"
        ? raw.suggestedNextAction
        : "",
    siteVisitSlot:
      typeof raw.siteVisitSlot === "string" ? raw.siteVisitSlot : null,
    timeline: normalizeTimeline(raw.timeline),
  };
}

export function parseStoredEnquiries(raw: string): {
  enquiries: StoredEnquiry[];
  needsMigration: boolean;
} {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return { enquiries: [], needsMigration: false };
    }

    let needsMigration = false;

    const enquiries = parsed
      .map((entry) => {
        if (enquiryRecordHadBinaryPhotoData(entry)) {
          needsMigration = true;
        }

        return normalizeEnquiry(entry);
      })
      .filter((entry): entry is StoredEnquiry => entry !== null)
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));

    return { enquiries, needsMigration };
  } catch {
    return { enquiries: [], needsMigration: false };
  }
}
