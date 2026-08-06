import { formatPenceForInput, parsePriceToPence } from "@/lib/proposals/money";

export type QuickQuoteMissingWarning = {
  id: string;
  label: string;
  /** Soft guidance — never blocks generate/save. */
  detail: string;
};

export type QuickQuotePrepNotes = {
  measurements: string;
  materialsRequired: string;
  accessRequirements: string;
  additionalNotes: string;
};

export const QUICK_QUOTE_CONFIRM_LATER =
  "You can confirm this later — it does not block creating or sending the quote.";

export const QUICK_QUOTE_SITE_VISIT_HINT =
  "Consider booking a site visit to confirm measurements.";

export function createEmptyPrepNotes(): QuickQuotePrepNotes {
  return {
    measurements: "",
    materialsRequired: "",
    accessRequirements: "",
    additionalNotes: "",
  };
}

function warning(
  id: string,
  label: string
): QuickQuoteMissingWarning {
  return {
    id,
    label,
    detail: QUICK_QUOTE_CONFIRM_LATER,
  };
}

/**
 * Soft quote-readiness guidance only — never blocks generate/save.
 */
export function getQuickQuoteMissingWarnings(options: {
  notes: QuickQuotePrepNotes;
  durationValue: string;
  plannedStartDateText: string;
  plannedStartDateExact: string;
}): QuickQuoteMissingWarning[] {
  const warnings: QuickQuoteMissingWarning[] = [];

  if (!options.notes.measurements.trim()) {
    warnings.push(warning("measurements", "Measurements to confirm"));
  }

  if (!options.notes.materialsRequired.trim()) {
    warnings.push(warning("materials", "Materials to confirm"));
  }

  if (!options.notes.accessRequirements.trim()) {
    warnings.push(
      warning("access", "Access requirements to confirm")
    );
  }

  if (!options.durationValue.trim()) {
    warnings.push(warning("duration", "Duration to confirm"));
  }

  const hasStartDate =
    Boolean(options.plannedStartDateText.trim()) ||
    Boolean(options.plannedStartDateExact.trim());

  if (!hasStartDate) {
    warnings.push(warning("start_date", "Start date to confirm"));
  }

  return warnings;
}

export function shouldSuggestSiteVisitForMeasurements(
  notes: QuickQuotePrepNotes
): boolean {
  return !notes.measurements.trim();
}

/** Internal cost build-up (trader only). Does not invent prices. */
export function sumQuickQuoteCosts(
  materials: string,
  labour: string,
  additional: string,
  margin: string = ""
): string {
  const amounts = [materials, labour, additional, margin].map((value) =>
    parsePriceToPence(value)
  );

  if (amounts.some((amount) => amount === null)) {
    return "";
  }

  const hasAny = [materials, labour, additional, margin].some((value) =>
    value.trim()
  );
  if (!hasAny) {
    return "";
  }

  const totalPence = amounts.reduce<number>(
    (sum, amount) => sum + (amount ?? 0),
    0
  );
  return formatPenceForInput(totalPence);
}

/**
 * Packs preparation notes into optionalExtras for generate/save.
 * Internal £ breakdown is excluded.
 * Readiness / next-steps belong on the PDF Next Steps section — not here.
 */
export function buildQuickQuoteOptionalExtras(options: {
  notes: QuickQuotePrepNotes;
}): string {
  const parts: string[] = [];
  const { notes } = options;

  if (notes.measurements.trim()) {
    parts.push(`Measurements / dimensions:\n${notes.measurements.trim()}`);
  }

  if (notes.materialsRequired.trim()) {
    parts.push(`Materials required:\n${notes.materialsRequired.trim()}`);
  }

  if (notes.accessRequirements.trim()) {
    parts.push(`Access requirements:\n${notes.accessRequirements.trim()}`);
  }

  if (notes.additionalNotes.trim()) {
    parts.push(`Additional notes:\n${notes.additionalNotes.trim()}`);
  }

  return parts.join("\n\n");
}
