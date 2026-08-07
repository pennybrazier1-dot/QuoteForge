import { formatPenceForInput, parsePriceToPence } from "@/lib/proposals/money";
import {
  getIncompleteQuoteReadinessItems,
  type QuoteReadinessInput,
  type QuoteReadinessItem,
} from "@/lib/proposals/quote-readiness";

export type QuickQuoteMissingWarning = {
  id: string;
  label: string;
  /** Soft guidance — never blocks generate/save. */
  detail: string;
  category?: string;
  categoryLabel?: string;
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

/**
 * Soft quote-readiness guidance only — never blocks generate/save.
 * Prefer getIncompleteQuoteReadinessItems for new UI.
 */
export function getQuickQuoteMissingWarnings(
  input: QuoteReadinessInput
): QuickQuoteMissingWarning[] {
  return getIncompleteQuoteReadinessItems(input).map((entry) => ({
    id: entry.id,
    label: entry.traderLabel,
    detail: entry.detail,
    category: entry.category,
    categoryLabel: entry.categoryLabel,
  }));
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
 * Packs preparation notes into site-notes context for AI extraction.
 * These are main-job details — never optional extras.
 */
export function buildQuickQuotePrepNotesSupplement(options: {
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

/**
 * Combines the main job notes with optional structured prep fields
 * for AI proposal generation.
 */
export function buildQuickQuoteSiteNotesForGenerate(options: {
  jobDescription: string;
  notes: QuickQuotePrepNotes;
}): string {
  const base = options.jobDescription.trim();
  const supplement = buildQuickQuotePrepNotesSupplement({
    notes: options.notes,
  });

  if (!supplement) {
    return base;
  }

  if (!base) {
    return supplement;
  }

  return `${base}\n\n${supplement}`;
}

/**
 * @deprecated Prep notes are no longer optional extras.
 * Prefer buildQuickQuotePrepNotesSupplement / buildQuickQuoteSiteNotesForGenerate.
 */
export function buildQuickQuoteOptionalExtras(options: {
  notes: QuickQuotePrepNotes;
}): string {
  return buildQuickQuotePrepNotesSupplement(options);
}

export type { QuoteReadinessInput, QuoteReadinessItem };
