import {
  shouldSuggestSiteVisitForMeasurements,
  type QuickQuoteMissingWarning,
  type QuickQuotePrepNotes,
} from "@/lib/proposals/quick-quote-preparation";

/** Customer-friendly readiness wording for proposal PDFs. Soft only — never blocks send. */
export const CUSTOMER_NEXT_STEP = {
  measurements: "Measurements to be confirmed",
  materials: "Materials / specification to be confirmed",
  siteVisit: "Site visit required",
  startDate: "Start date to be confirmed",
} as const;

const CUSTOMER_NEXT_STEP_VALUES = new Set<string>(
  Object.values(CUSTOMER_NEXT_STEP)
);

export function buildCustomerNextStepsFromWarnings(options: {
  missingWarnings: QuickQuoteMissingWarning[];
  suggestSiteVisit: boolean;
}): string[] {
  const ids = new Set(options.missingWarnings.map((item) => item.id));
  const steps: string[] = [];

  if (ids.has("measurements")) {
    steps.push(CUSTOMER_NEXT_STEP.measurements);
  }

  if (ids.has("materials")) {
    steps.push(CUSTOMER_NEXT_STEP.materials);
  }

  if (options.suggestSiteVisit || ids.has("measurements")) {
    steps.push(CUSTOMER_NEXT_STEP.siteVisit);
  }

  if (ids.has("start_date")) {
    steps.push(CUSTOMER_NEXT_STEP.startDate);
  }

  return dedupeSteps(steps);
}

export function buildCustomerNextStepsFromPrep(options: {
  notes: QuickQuotePrepNotes;
  plannedStartDateText: string;
  plannedStartDateExact: string;
}): string[] {
  const missingWarnings: QuickQuoteMissingWarning[] = [];

  if (!options.notes.measurements.trim()) {
    missingWarnings.push({
      id: "measurements",
      label: "Measurements to confirm",
      detail: "",
    });
  }

  if (!options.notes.materialsRequired.trim()) {
    missingWarnings.push({
      id: "materials",
      label: "Materials to confirm",
      detail: "",
    });
  }

  const hasStartDate =
    Boolean(options.plannedStartDateText.trim()) ||
    Boolean(options.plannedStartDateExact.trim());

  if (!hasStartDate) {
    missingWarnings.push({
      id: "start_date",
      label: "Start date to confirm",
      detail: "",
    });
  }

  return buildCustomerNextStepsFromWarnings({
    missingWarnings,
    suggestSiteVisit: shouldSuggestSiteVisitForMeasurements(options.notes),
  });
}

/**
 * Resolve customer next-steps for a saved proposal.
 * Uses stored customer phrases first, then legacy readiness blurbs in extras.
 */
export function deriveCustomerNextSteps(options: {
  thingsToConfirm: string[];
  optionalExtrasText: string;
}): string[] {
  const steps: string[] = [];

  for (const item of options.thingsToConfirm) {
    const trimmed = item.trim();
    if (CUSTOMER_NEXT_STEP_VALUES.has(trimmed)) {
      steps.push(trimmed);
    }
  }

  const extras = options.optionalExtrasText;

  if (/still to confirm later:/i.test(extras)) {
    if (
      /measurements/i.test(extras) &&
      !steps.includes(CUSTOMER_NEXT_STEP.measurements)
    ) {
      steps.push(CUSTOMER_NEXT_STEP.measurements);
    }
    if (
      /materials/i.test(extras) &&
      !steps.includes(CUSTOMER_NEXT_STEP.materials)
    ) {
      steps.push(CUSTOMER_NEXT_STEP.materials);
    }
    if (
      /start date/i.test(extras) &&
      !steps.includes(CUSTOMER_NEXT_STEP.startDate)
    ) {
      steps.push(CUSTOMER_NEXT_STEP.startDate);
    }
  }

  if (
    (/consider booking a site visit/i.test(extras) ||
      steps.includes(CUSTOMER_NEXT_STEP.measurements)) &&
    !steps.includes(CUSTOMER_NEXT_STEP.siteVisit)
  ) {
    steps.push(CUSTOMER_NEXT_STEP.siteVisit);
  }

  // Also recognise freestanding customer phrases that may already be stored.
  for (const phrase of Object.values(CUSTOMER_NEXT_STEP)) {
    if (
      extras.toLowerCase().includes(phrase.toLowerCase()) &&
      !steps.includes(phrase)
    ) {
      steps.push(phrase);
    }
  }

  return dedupeSteps(steps);
}

/**
 * Keep technical "Things to Confirm" free of the dedicated next-steps copy.
 */
export function withoutCustomerNextSteps(items: string[]): string[] {
  return items.filter((item) => !CUSTOMER_NEXT_STEP_VALUES.has(item.trim()));
}

/**
 * Remove readiness blurbs previously packed into optional extras.
 */
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
      if (
        CUSTOMER_NEXT_STEP_VALUES.has(block) ||
        /^next steps?:/i.test(block)
      ) {
        return false;
      }
      return true;
    })
    .join("\n\n");
}

/** Strip line-item £ amounts so only the final agreed price remains customer-facing. */
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

function dedupeSteps(steps: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const step of steps) {
    const key = step.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}
