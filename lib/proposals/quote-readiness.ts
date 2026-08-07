import { parsePriceToPence } from "@/lib/proposals/money";
import type { QuickQuotePrepNotes } from "@/lib/proposals/quick-quote-preparation";

export type QuoteReadinessCategory =
  | "customer"
  | "site"
  | "job"
  | "planning"
  | "pricing";

export type QuoteReadinessItemId =
  | "customer_contact"
  | "full_address"
  | "measurements"
  | "photos"
  | "site_visit"
  | "access"
  | "scope"
  | "materials"
  | "customer_choices"
  | "duration"
  | "start_date"
  | "pricing"
  | "payment_terms";

export type QuoteReadinessItem = {
  id: QuoteReadinessItemId;
  category: QuoteReadinessCategory;
  categoryLabel: string;
  /** Soft trader reminder wording. */
  traderLabel: string;
  /**
   * Friendly customer PDF wording.
   * Null = trader-only (never appear on the customer PDF).
   */
  customerLabel: string | null;
  detail: string;
};

export type QuoteReadinessInput = {
  customerName: string;
  emailAddress: string;
  phoneNumber: string;
  propertyAddress: string;
  notes: QuickQuotePrepNotes;
  jobDescription: string;
  photoCount: number;
  photosNotRequired: boolean;
  siteVisitCompleted: boolean;
  durationValue: string;
  plannedStartDateText: string;
  plannedStartDateExact: string;
  estimatedPrice: string;
  /** When false, payment-terms check is omitted (not supported in this flow). */
  paymentTermsSupported?: boolean;
  paymentTerms?: string;
  /**
   * AI-first Quick Quote: when job notes are present, skip only the empty
   * “scope” reminder. Confirmation checklist items still appear.
   */
  aiNotesFirst?: boolean;
};

export const QUOTE_READINESS_CONFIRM_LATER =
  "You can confirm this later — it does not block creating or sending the quote.";

const CATEGORY_LABELS: Record<QuoteReadinessCategory, string> = {
  customer: "Customer",
  site: "Site",
  job: "Job",
  planning: "Planning",
  pricing: "Pricing",
};

function item(
  id: QuoteReadinessItemId,
  category: QuoteReadinessCategory,
  traderLabel: string,
  customerLabel: string | null
): QuoteReadinessItem {
  return {
    id,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    traderLabel,
    customerLabel,
    detail: QUOTE_READINESS_CONFIRM_LATER,
  };
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasCustomerContact(input: QuoteReadinessInput): boolean {
  return (
    hasText(input.customerName) &&
    (hasText(input.emailAddress) || hasText(input.phoneNumber))
  );
}

function hasStartDate(input: QuoteReadinessInput): boolean {
  return (
    hasText(input.plannedStartDateText) || hasText(input.plannedStartDateExact)
  );
}

function hasPricing(input: QuoteReadinessInput): boolean {
  if (!hasText(input.estimatedPrice)) {
    return false;
  }
  return parsePriceToPence(input.estimatedPrice) !== null;
}

function isSiteVisitRelevant(input: QuoteReadinessInput): boolean {
  // Site visits matter most when measurements are still unknown.
  return !hasText(input.notes.measurements);
}

function isPhotosComplete(input: QuoteReadinessInput): boolean {
  return input.photoCount > 0 || input.photosNotRequired;
}

/**
 * Soft quote-readiness checklist for traders.
 * Never blocks create/send — returns only incomplete items.
 *
 * Trader labels = internal checklist.
 * customerLabel = PDF wording (null = trader-only).
 */
export function getIncompleteQuoteReadinessItems(
  input: QuoteReadinessInput
): QuoteReadinessItem[] {
  const missing: QuoteReadinessItem[] = [];
  const hasJobNotes = hasText(input.jobDescription);

  // Customer
  if (!hasCustomerContact(input)) {
    missing.push(
      item(
        "customer_contact",
        "customer",
        "Customer contact details to confirm",
        null
      )
    );
  }

  if (!hasText(input.propertyAddress)) {
    missing.push(
      item("full_address", "customer", "Full address to confirm", null)
    );
  }

  // Site
  if (!hasText(input.notes.measurements)) {
    missing.push(
      item(
        "measurements",
        "site",
        "Measurements to confirm",
        "Final measurements to be confirmed."
      )
    );
  }

  if (!isPhotosComplete(input)) {
    missing.push(
      item(
        "photos",
        "site",
        "Photos/site conditions to confirm",
        "Site photos and conditions to be confirmed."
      )
    );
  }

  if (isSiteVisitRelevant(input) && !input.siteVisitCompleted) {
    missing.push(
      item(
        "site_visit",
        "site",
        "Site inspection to confirm",
        "Site visit recommended to confirm final measurements."
      )
    );
  }

  if (!hasText(input.notes.accessRequirements)) {
    missing.push(
      item(
        "access",
        "site",
        "Access requirements to confirm",
        "Access arrangements to be confirmed."
      )
    );
  }

  // Job
  // AI-first: job notes count as scope capture — still soft-remind if blank.
  if (!hasJobNotes) {
    missing.push(
      item(
        "scope",
        "job",
        "Final scope/details to confirm",
        "Final job details to be confirmed."
      )
    );
  } else if (!input.aiNotesFirst && input.jobDescription.trim().length < 40) {
    missing.push(
      item(
        "scope",
        "job",
        "Final scope/details to confirm",
        "Final job details to be confirmed."
      )
    );
  }

  if (!hasText(input.notes.materialsRequired)) {
    missing.push(
      item(
        "materials",
        "job",
        "Materials/specifications to confirm",
        "Materials and finishes to be confirmed."
      )
    );
  }

  if (
    !hasText(input.notes.materialsRequired) &&
    !hasText(input.notes.additionalNotes)
  ) {
    missing.push(
      item(
        "customer_choices",
        "job",
        "Customer choices to confirm",
        "Materials and finishes to be confirmed."
      )
    );
  }

  // Planning
  if (!hasText(input.durationValue)) {
    missing.push(
      item("duration", "planning", "Duration to confirm", null)
    );
  }

  if (!hasStartDate(input)) {
    missing.push(
      item(
        "start_date",
        "planning",
        "Start date to confirm",
        "Start date to be confirmed."
      )
    );
  }

  // Pricing
  if (!hasPricing(input)) {
    missing.push(
      item("pricing", "pricing", "Pricing to complete", null)
    );
  }

  if (input.paymentTermsSupported) {
    if (!hasText(input.paymentTerms)) {
      missing.push(
        item(
          "payment_terms",
          "pricing",
          "Payment terms to confirm",
          null
        )
      );
    }
  }

  return missing;
}

export function groupIncompleteReadinessByCategory(
  items: QuoteReadinessItem[]
): Array<{ category: QuoteReadinessCategory; label: string; items: QuoteReadinessItem[] }> {
  const order: QuoteReadinessCategory[] = [
    "customer",
    "site",
    "job",
    "planning",
    "pricing",
  ];

  return order
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: items.filter((entry) => entry.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

/** Friendly PDF bullets — empty when everything relevant is complete. */
export function buildCustomerThingsToConfirm(
  items: QuoteReadinessItem[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of items) {
    const label = entry.customerLabel?.trim();
    if (!label || seen.has(label)) {
      continue;
    }
    seen.add(label);
    result.push(label);
  }

  return result;
}

export const KNOWN_CUSTOMER_THINGS_TO_CONFIRM = new Set(
  [
    "Final measurements to be confirmed.",
    "Measurements to be confirmed",
    "Site photos and conditions to be confirmed.",
    "Site photos / conditions to be confirmed",
    "Site visit recommended to confirm final measurements.",
    "Site visit recommended to confirm final measurements and requirements.",
    "A site visit may be needed before work begins",
    "Site visit required",
    "Access arrangements to be confirmed.",
    "Site access arrangements to be confirmed.",
    "Site access to be confirmed",
    "Materials and finishes to be confirmed.",
    "Materials and specification to be confirmed.",
    "Materials / specification to be confirmed",
    "Final finishes and choices to be confirmed.",
    "Final choices (for example finishes) to be confirmed",
    "Final job details to be confirmed.",
    "Start date to be confirmed.",
    "Start date to be confirmed",
  ].map((value) => value.toLowerCase())
);

export function isKnownCustomerThingToConfirm(value: string): boolean {
  return KNOWN_CUSTOMER_THINGS_TO_CONFIRM.has(value.trim().toLowerCase());
}
