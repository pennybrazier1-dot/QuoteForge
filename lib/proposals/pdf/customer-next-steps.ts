import {
  CUSTOMER_CONFIRM_COPY,
  toCustomerFacingThingsToConfirm,
} from "@/lib/proposals/pdf/customer-confirm-copy";
import {
  buildCustomerThingsToConfirm,
  getIncompleteQuoteReadinessItems,
  isKnownCustomerThingToConfirm,
  type QuoteReadinessInput,
  type QuoteReadinessItem,
} from "@/lib/proposals/quote-readiness";
import type { QuickQuotePrepNotes } from "@/lib/proposals/quick-quote-preparation";

/** @deprecated Prefer buildCustomerThingsToConfirm — kept for clear call sites. */
export function buildCustomerNextStepsFromPrep(options: {
  notes: QuickQuotePrepNotes;
  plannedStartDateText: string;
  plannedStartDateExact: string;
  customerName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  propertyAddress?: string;
  jobDescription?: string;
  photoCount?: number;
  photosNotRequired?: boolean;
  siteVisitCompleted?: boolean;
  durationValue?: string;
  estimatedPrice?: string;
  aiNotesFirst?: boolean;
}): string[] {
  const incomplete = getIncompleteQuoteReadinessItems({
    customerName: options.customerName ?? "",
    emailAddress: options.emailAddress ?? "",
    phoneNumber: options.phoneNumber ?? "",
    propertyAddress: options.propertyAddress ?? "",
    notes: options.notes,
    jobDescription: options.jobDescription ?? " ",
    photoCount: options.photoCount ?? 0,
    photosNotRequired: options.photosNotRequired ?? false,
    siteVisitCompleted: options.siteVisitCompleted ?? false,
    durationValue: options.durationValue ?? " ",
    plannedStartDateText: options.plannedStartDateText,
    plannedStartDateExact: options.plannedStartDateExact,
    estimatedPrice: options.estimatedPrice ?? "1",
    paymentTermsSupported: false,
    aiNotesFirst: options.aiNotesFirst ?? true,
  });

  return toCustomerFacingThingsToConfirm(
    buildCustomerThingsToConfirm(incomplete)
  );
}

export function buildCustomerThingsToConfirmFromInput(
  input: QuoteReadinessInput
): string[] {
  return toCustomerFacingThingsToConfirm(
    buildCustomerThingsToConfirm(getIncompleteQuoteReadinessItems(input))
  );
}

/**
 * Resolve customer-facing "Before Work Begins" bullets for a saved proposal.
 * Rewrites AI/internal wording; never shows trader checklist language.
 */
export function deriveCustomerThingsToConfirm(options: {
  thingsToConfirm: string[];
  optionalExtrasText: string;
  materials?: string[];
  plannedStartDateText?: string | null;
  plannedStartDateExact?: string | null;
}): string[] {
  const steps: string[] = [...options.thingsToConfirm];
  const extras = options.optionalExtrasText;
  const materials = options.materials ?? [];

  if (/still to confirm later:/i.test(extras)) {
    if (/measurements/i.test(extras)) {
      steps.push(CUSTOMER_CONFIRM_COPY.measurements);
    }
    if (/materials/i.test(extras)) {
      steps.push(CUSTOMER_CONFIRM_COPY.materials);
    }
    if (/start date/i.test(extras)) {
      steps.push(CUSTOMER_CONFIRM_COPY.startDate);
    }
    if (/access/i.test(extras)) {
      steps.push(CUSTOMER_CONFIRM_COPY.access);
    }
    if (/photo/i.test(extras)) {
      steps.push(CUSTOMER_CONFIRM_COPY.photos);
    }
  }

  if (
    /consider booking a site visit|site visit required|site visit may be needed|what we find when we visit|site inspection/i.test(
      extras
    ) ||
    steps.some((step) => /measurement|site visit|site inspection/i.test(step))
  ) {
    steps.push(CUSTOMER_CONFIRM_COPY.siteVisit);
  }

  if (
    materials.length === 0 ||
    materials.some((item) => /to be confirmed|tbc|t\.b\.c/i.test(item))
  ) {
    steps.push(CUSTOMER_CONFIRM_COPY.materials);
  }

  const hasStartDate =
    Boolean(options.plannedStartDateText?.trim()) ||
    Boolean(options.plannedStartDateExact?.trim());
  if (!hasStartDate) {
    steps.push(CUSTOMER_CONFIRM_COPY.startDate);
  }

  return toCustomerFacingThingsToConfirm(steps);
}

/** Keep technical AI confirms free of readiness / customer PDF copy. */
export function withoutCustomerNextSteps(items: string[]): string[] {
  return items.filter((item) => !isKnownCustomerThingToConfirm(item));
}

export function stripReadinessFromOptionalExtras(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => {
      if (/^still to confirm later:/i.test(block)) {
        return false;
      }
      if (/consider booking a site visit/i.test(block)) {
        return false;
      }
      if (/^measurements?\s*\/\s*dimensions:/i.test(block)) {
        return false;
      }
      if (/^materials required:/i.test(block)) {
        return false;
      }
      if (/^access requirements:/i.test(block)) {
        return false;
      }
      if (/^additional notes:/i.test(block)) {
        return false;
      }
      if (/^additional requirements:/i.test(block)) {
        return false;
      }
      if (/^customer choices:/i.test(block)) {
        return false;
      }
      if (isKnownCustomerThingToConfirm(block) || /^next steps?:/i.test(block)) {
        return false;
      }
      return true;
    })
    .join("\n\n");
}

/**
 * Prepare optional extras for the customer PDF.
 * Returns only real optional items — never prep notes or empty placeholders.
 */
export function resolveCustomerOptionalExtras(items: string[]): string[] {
  const cleaned: string[] = [];

  for (const raw of items) {
    const item = raw.trim();
    if (!item) {
      continue;
    }

    // Drop whole multi-line prep blocks packed by older Quick Quote flows.
    if (
      /^(measurements?\s*\/\s*dimensions|materials required|customer choices|access requirements|additional notes|additional requirements)\s*:/i.test(
        item
      )
    ) {
      continue;
    }

    if (/^still to confirm later:/i.test(item)) {
      continue;
    }
    if (/consider booking a site visit/i.test(item)) {
      continue;
    }

    cleaned.push(item);
  }

  return cleaned;
}

export function parseOptionalExtrasSource(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  const formatted = formatOptionalExtrasForFormSafe(value);
  if (!formatted) {
    return [];
  }

  // Preserve multi-line blocks that belong together (prep note leftovers).
  return formatted
    .split(/\n(?=[A-Z][^:\n]{0,40}:)/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function formatOptionalExtrasForFormSafe(value: unknown): string {
  if (!Array.isArray(value)) {
    return typeof value === "string" ? value : "";
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .join("\n\n");
}

export function stripCustomerFacingLinePrices(items: string[]): string[] {
  return items
    .map((item) =>
      item
        .replace(/\s*[—–-]\s*£[\d,]+(?:\.\d{1,2})?\s*$/u, "")
        .replace(/\s*\(£[\d,]+(?:\.\d{1,2})?\)\s*$/u, "")
        .trim()
    )
    .filter(Boolean);
}

export function mergeCustomerNextStepsIntoThingsToConfirm(
  thingsToConfirm: string[],
  nextSteps: string[]
): string[] {
  return toCustomerFacingThingsToConfirm([...nextSteps, ...thingsToConfirm]);
}

/** @deprecated Use deriveCustomerThingsToConfirm */
export function deriveCustomerNextSteps(options: {
  thingsToConfirm: string[];
  optionalExtrasText: string;
}): string[] {
  return deriveCustomerThingsToConfirm(options);
}

export function readinessItemsToCustomerLabels(
  items: QuoteReadinessItem[]
): string[] {
  return toCustomerFacingThingsToConfirm(buildCustomerThingsToConfirm(items));
}

// Re-export for tests and callers.
export const CUSTOMER_NEXT_STEP = {
  measurements: CUSTOMER_CONFIRM_COPY.measurements,
  materials: CUSTOMER_CONFIRM_COPY.materials,
  siteVisit: CUSTOMER_CONFIRM_COPY.siteVisit,
  startDate: CUSTOMER_CONFIRM_COPY.startDate,
  photos: CUSTOMER_CONFIRM_COPY.photos,
  access: CUSTOMER_CONFIRM_COPY.access,
  choices: CUSTOMER_CONFIRM_COPY.choices,
} as const;
