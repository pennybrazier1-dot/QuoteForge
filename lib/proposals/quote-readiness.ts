import { parsePriceToPence } from "@/lib/proposals/money";
import type { QuickQuotePrepNotes } from "@/lib/proposals/quick-quote-preparation";

export type QuoteReadinessCategory =
  | "customer"
  | "site"
  | "job"
  | "planning"
  | "pricing";

export type QuoteReadinessItemId =
  | "customer_name"
  | "customer_phone"
  | "customer_email"
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

  // Customer — each essential checked separately
  if (!hasText(input.customerName)) {
    missing.push(
      item("customer_name", "customer", "Customer name to confirm", null)
    );
  }

  if (!hasText(input.phoneNumber)) {
    missing.push(
      item(
        "customer_phone",
        "customer",
        "Customer phone number to confirm",
        null
      )
    );
  }

  if (!hasText(input.emailAddress)) {
    missing.push(
      item("customer_email", "customer", "Customer email to confirm", null)
    );
  }

  if (!hasText(input.propertyAddress)) {
    missing.push(
      item("full_address", "customer", "Job address to confirm", null)
    );
  }

  // Site
  if (!hasText(input.notes.measurements)) {
    missing.push(
      item(
        "measurements",
        "site",
        "Measurements to confirm",
        "Measurements to be confirmed."
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
        "Site visit recommended to confirm measurements."
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
        "Materials to be confirmed."
      )
    );
  }

  if (!hasText(input.notes.customerChoices)) {
    missing.push(
      item(
        "customer_choices",
        "job",
        "Customer choices to confirm",
        "Materials to be confirmed."
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
    "Measurements to be confirmed.",
    "Measurements to be confirmed",
    "Site photos and conditions to be confirmed.",
    "Site photos / conditions to be confirmed",
    "Site visit recommended to confirm measurements.",
    "Site visit recommended to confirm final measurements.",
    "Site visit recommended to confirm final measurements and requirements.",
    "A site visit may be needed before work begins",
    "Site visit required",
    "Access arrangements to be confirmed.",
    "Site access arrangements to be confirmed.",
    "Site access to be confirmed",
    "Materials and finishes to be confirmed.",
    "Materials to be confirmed.",
    "Materials and specification to be confirmed.",
    "Materials / specification to be confirmed",
    "Final finishes and choices to be confirmed.",
    "Final choices (for example finishes) to be confirmed",
    "Customer choices to be confirmed.",
    "Final job details to be confirmed.",
    "Dates to be confirmed.",
    "Start date to be confirmed.",
    "Start date to be confirmed",
    "Timescale to be confirmed.",
  ].map((value) => value.toLowerCase())
);

export function isKnownCustomerThingToConfirm(value: string): boolean {
  return KNOWN_CUSTOMER_THINGS_TO_CONFIRM.has(value.trim().toLowerCase());
}

/** Short trader summary labels — not a duplicate input checklist. */
const THINGS_TO_CONFIRM_SUMMARY_LABELS: Record<QuoteReadinessItemId, string> = {
  customer_name: "Customer name",
  customer_phone: "Customer phone number",
  customer_email: "Customer email",
  full_address: "Job address",
  measurements: "Measurements to be confirmed",
  photos: "Photos / site conditions",
  site_visit: "Site visit recommended to confirm measurements",
  access: "Access to be confirmed",
  scope: "Job notes / scope",
  materials: "Materials to be confirmed",
  customer_choices: "Customer choices to be confirmed",
  duration: "Duration to be confirmed",
  start_date: "Start date to be confirmed",
  pricing: "Customer quote total",
  payment_terms: "Payment terms",
};

export type ThingsToConfirmSummaryGroupId =
  | "customer"
  | "job"
  | "planning";

export type ThingsToConfirmSummaryItem = {
  id: string;
  label: string;
  children?: string[];
};

export type ThingsToConfirmSummaryGroup = {
  id: ThingsToConfirmSummaryGroupId;
  title: string;
  items: ThingsToConfirmSummaryItem[];
};

function hasId(
  items: QuoteReadinessItem[],
  id: QuoteReadinessItemId
): boolean {
  return items.some((entry) => entry.id === id);
}

/** Fold related open items into one parent + optional children. */
function foldJobSummaryItems(
  items: QuoteReadinessItem[]
): ThingsToConfirmSummaryItem[] {
  const result: ThingsToConfirmSummaryItem[] = [];
  const used = new Set<QuoteReadinessItemId>();

  if (hasId(items, "measurements") || hasId(items, "site_visit")) {
    const children: string[] = [];
    if (hasId(items, "site_visit")) {
      children.push(
        THINGS_TO_CONFIRM_SUMMARY_LABELS.site_visit
      );
    }
    result.push({
      id: "measurements",
      label: THINGS_TO_CONFIRM_SUMMARY_LABELS.measurements,
      children: children.length > 0 ? children : undefined,
    });
    used.add("measurements");
    used.add("site_visit");
  }

  if (hasId(items, "access")) {
    result.push({
      id: "access",
      label: THINGS_TO_CONFIRM_SUMMARY_LABELS.access,
    });
    used.add("access");
  }

  if (hasId(items, "photos")) {
    result.push({
      id: "photos",
      label: THINGS_TO_CONFIRM_SUMMARY_LABELS.photos,
    });
    used.add("photos");
  }

  if (hasId(items, "materials") || hasId(items, "customer_choices")) {
    const children: string[] = [];
    if (hasId(items, "customer_choices") && hasId(items, "materials")) {
      children.push(THINGS_TO_CONFIRM_SUMMARY_LABELS.customer_choices);
    }
    result.push({
      id: hasId(items, "materials") ? "materials" : "customer_choices",
      label: hasId(items, "materials")
        ? THINGS_TO_CONFIRM_SUMMARY_LABELS.materials
        : THINGS_TO_CONFIRM_SUMMARY_LABELS.customer_choices,
      children: children.length > 0 ? children : undefined,
    });
    used.add("materials");
    used.add("customer_choices");
  }

  if (hasId(items, "scope")) {
    result.push({
      id: "scope",
      label: THINGS_TO_CONFIRM_SUMMARY_LABELS.scope,
    });
    used.add("scope");
  }

  for (const entry of items) {
    if (used.has(entry.id)) {
      continue;
    }
    result.push({
      id: entry.id,
      label: THINGS_TO_CONFIRM_SUMMARY_LABELS[entry.id] ?? entry.traderLabel,
    });
  }

  return result;
}

function foldPlanningSummaryItems(
  items: QuoteReadinessItem[]
): ThingsToConfirmSummaryItem[] {
  const result: ThingsToConfirmSummaryItem[] = [];
  const used = new Set<QuoteReadinessItemId>();

  if (hasId(items, "duration") || hasId(items, "start_date")) {
    const children: string[] = [];
    if (hasId(items, "duration")) {
      children.push(THINGS_TO_CONFIRM_SUMMARY_LABELS.duration);
    }
    if (hasId(items, "start_date")) {
      children.push(THINGS_TO_CONFIRM_SUMMARY_LABELS.start_date);
    }
    result.push({
      id: "dates",
      label: "Dates to be confirmed",
      children: children.length > 1 ? children : undefined,
    });
    // Single date item — use the specific label instead of the group title alone.
    if (children.length === 1) {
      result[result.length - 1] = {
        id: hasId(items, "start_date") ? "start_date" : "duration",
        label: children[0],
      };
    }
    used.add("duration");
    used.add("start_date");
  }

  for (const entry of items) {
    if (used.has(entry.id)) {
      continue;
    }
    result.push({
      id: entry.id,
      label: THINGS_TO_CONFIRM_SUMMARY_LABELS[entry.id] ?? entry.traderLabel,
    });
  }

  return result;
}

/**
 * Generated “Things to confirm” summary for Quick Quote.
 * Soft only — never blocks create/send. No input fields.
 */
export function buildThingsToConfirmSummary(
  input: QuoteReadinessInput
): {
  ready: boolean;
  groups: ThingsToConfirmSummaryGroup[];
} {
  const incomplete = getIncompleteQuoteReadinessItems(input);

  const buckets: Record<
    ThingsToConfirmSummaryGroupId,
    QuoteReadinessItem[]
  > = {
    customer: [],
    job: [],
    planning: [],
  };

  for (const entry of incomplete) {
    if (entry.category === "customer") {
      buckets.customer.push(entry);
    } else if (entry.category === "site" || entry.category === "job") {
      buckets.job.push(entry);
    } else if (entry.category === "planning" || entry.category === "pricing") {
      buckets.planning.push(entry);
    }
  }

  const titles: Record<ThingsToConfirmSummaryGroupId, string> = {
    customer: "Missing customer information",
    job: "Missing job information",
    planning: "Missing planning information",
  };

  const groups: ThingsToConfirmSummaryGroup[] = [];

  if (buckets.customer.length > 0) {
    groups.push({
      id: "customer",
      title: titles.customer,
      items: buckets.customer.map((entry) => ({
        id: entry.id,
        label: THINGS_TO_CONFIRM_SUMMARY_LABELS[entry.id] ?? entry.traderLabel,
      })),
    });
  }

  if (buckets.job.length > 0) {
    groups.push({
      id: "job",
      title: titles.job,
      items: foldJobSummaryItems(buckets.job),
    });
  }

  if (buckets.planning.length > 0) {
    groups.push({
      id: "planning",
      title: titles.planning,
      items: foldPlanningSummaryItems(buckets.planning),
    });
  }

  return {
    ready: groups.length === 0,
    groups,
  };
}
