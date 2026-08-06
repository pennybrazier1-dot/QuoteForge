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
  });

  return buildCustomerThingsToConfirm(incomplete);
}

export function buildCustomerThingsToConfirmFromInput(
  input: QuoteReadinessInput
): string[] {
  return buildCustomerThingsToConfirm(getIncompleteQuoteReadinessItems(input));
}

/**
 * Resolve customer-facing "Things to confirm before work begins" for a saved proposal.
 */
export function deriveCustomerThingsToConfirm(options: {
  thingsToConfirm: string[];
  optionalExtrasText: string;
}): string[] {
  const steps: string[] = [];

  for (const entry of options.thingsToConfirm) {
    const trimmed = entry.trim();
    if (isKnownCustomerThingToConfirm(trimmed)) {
      steps.push(normalizeCustomerPhrase(trimmed));
    }
  }

  const extras = options.optionalExtrasText;

  if (/still to confirm later:/i.test(extras)) {
    if (/measurements/i.test(extras)) {
      steps.push("Measurements to be confirmed");
    }
    if (/materials/i.test(extras)) {
      steps.push("Materials / specification to be confirmed");
    }
    if (/start date/i.test(extras)) {
      steps.push("Start date to be confirmed");
    }
    if (/access/i.test(extras)) {
      steps.push("Site access to be confirmed");
    }
    if (/photo/i.test(extras)) {
      steps.push("Site photos / conditions to be confirmed");
    }
  }

  if (
    (/consider booking a site visit|site visit required|site visit may be needed/i.test(
      extras
    ) ||
      steps.includes("Measurements to be confirmed")) &&
    !steps.some((step) => /site visit/i.test(step))
  ) {
    steps.push("A site visit may be needed before work begins");
  }

  return dedupeSteps(steps);
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
      if (isKnownCustomerThingToConfirm(block) || /^next steps?:/i.test(block)) {
        return false;
      }
      return true;
    })
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
  return dedupeSteps([...nextSteps, ...thingsToConfirm]);
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
  return buildCustomerThingsToConfirm(items);
}

function normalizeCustomerPhrase(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower === "site visit required") {
    return "A site visit may be needed before work begins";
  }
  return value.trim();
}

function dedupeSteps(steps: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const step of steps) {
    const key = normalizeCustomerPhrase(step);
    if (!key || seen.has(key.toLowerCase())) {
      continue;
    }
    seen.add(key.toLowerCase());
    result.push(key);
  }
  return result;
}

// Re-export legacy constant name used by older tests/callers during transition.
export const CUSTOMER_NEXT_STEP = {
  measurements: "Measurements to be confirmed",
  materials: "Materials / specification to be confirmed",
  siteVisit: "A site visit may be needed before work begins",
  startDate: "Start date to be confirmed",
  photos: "Site photos / conditions to be confirmed",
  access: "Site access to be confirmed",
  choices: "Final choices (for example finishes) to be confirmed",
} as const;
