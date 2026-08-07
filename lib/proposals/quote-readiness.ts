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
   * AI-first Quick Quote: when job notes are present, skip soft reminders for
   * fields AI can extract from those notes.
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
 */
export function getIncompleteQuoteReadinessItems(
  input: QuoteReadinessInput
): QuoteReadinessItem[] {
  const missing: QuoteReadinessItem[] = [];
  const notesCarryDetail =
    Boolean(input.aiNotesFirst) && hasText(input.jobDescription);

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
  if (!notesCarryDetail && !hasText(input.notes.measurements)) {
    missing.push(
      item(
        "measurements",
        "site",
        "Measurements/dimensions to confirm",
        "Measurements to be confirmed"
      )
    );
  }

  if (!isPhotosComplete(input)) {
    missing.push(
      item(
        "photos",
        "site",
        "Photos/site conditions to confirm",
        "Site photos / conditions to be confirmed"
      )
    );
  }

  if (
    !notesCarryDetail &&
    isSiteVisitRelevant(input) &&
    !input.siteVisitCompleted
  ) {
    missing.push(
      item(
        "site_visit",
        "site",
        "Site visit to confirm",
        "A site visit may be needed before work begins"
      )
    );
  }

  if (!notesCarryDetail && !hasText(input.notes.accessRequirements)) {
    missing.push(
      item(
        "access",
        "site",
        "Access requirements to confirm",
        "Site access to be confirmed"
      )
    );
  }

  // Job
  if (!hasText(input.jobDescription)) {
    missing.push(
      item("scope", "job", "Scope of work to confirm", null)
    );
  }

  if (!notesCarryDetail && !hasText(input.notes.materialsRequired)) {
    missing.push(
      item(
        "materials",
        "job",
        "Materials/specifications to confirm",
        "Materials / specification to be confirmed"
      )
    );
  }

  if (
    !notesCarryDetail &&
    !hasText(input.notes.materialsRequired) &&
    !hasText(input.notes.additionalNotes)
  ) {
    missing.push(
      item(
        "customer_choices",
        "job",
        "Customer choices to confirm",
        "Final choices (for example finishes) to be confirmed"
      )
    );
  }

  // Planning
  if (!notesCarryDetail && !hasText(input.durationValue)) {
    missing.push(
      item("duration", "planning", "Duration to confirm", null)
    );
  }

  if (!notesCarryDetail && !hasStartDate(input)) {
    missing.push(
      item(
        "start_date",
        "planning",
        "Start date to confirm",
        "Start date to be confirmed"
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
    "Measurements to be confirmed",
    "Site photos / conditions to be confirmed",
    "A site visit may be needed before work begins",
    "Site access to be confirmed",
    "Materials / specification to be confirmed",
    "Final choices (for example finishes) to be confirmed",
    "Start date to be confirmed",
    // Legacy Phase 41 phrases
    "Site visit required",
    "Materials / specification to be confirmed",
  ].map((value) => value.toLowerCase())
);

export function isKnownCustomerThingToConfirm(value: string): boolean {
  return KNOWN_CUSTOMER_THINGS_TO_CONFIRM.has(value.trim().toLowerCase());
}
