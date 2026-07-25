import type {
  QuoteMissingCheck,
  QuotePreparationDraft,
} from "@/lib/proposals/quote-preparation/types";

function hasLabourEstimate(draft: QuotePreparationDraft): boolean {
  return draft.labourItems.some(
    (item) =>
      item.description.trim() &&
      (item.quantity.trim() || item.rate.trim() || item.lineTotal.trim())
  );
}

function hasMaterialPrices(draft: QuotePreparationDraft): boolean {
  if (draft.materials.length === 0) {
    return false;
  }

  return draft.materials.some((item) => item.price.trim().length > 0);
}

function hasVatTreatment(draft: QuotePreparationDraft): boolean {
  return draft.vatEnabled || draft.vatAmount.trim().length > 0;
}

function hasTimescale(draft: QuotePreparationDraft): boolean {
  return Boolean(
    draft.expectedTimescale.trim() ||
      draft.plannedStartDateText.trim() ||
      draft.plannedStartDateExact.trim()
  );
}

function hasMeasurements(draft: QuotePreparationDraft): boolean {
  return draft.measurementsText.trim().length > 0;
}

export function getQuoteMissingChecks(
  draft: QuotePreparationDraft
): QuoteMissingCheck[] {
  const checks: QuoteMissingCheck[] = [];

  if (!hasLabourEstimate(draft)) {
    checks.push({ id: "labour", label: "Labour estimate" });
  }

  if (!hasMaterialPrices(draft)) {
    checks.push({ id: "materials", label: "Material prices" });
  }

  if (!hasVatTreatment(draft)) {
    checks.push({ id: "vat", label: "VAT treatment" });
  }

  if (!hasTimescale(draft)) {
    checks.push({ id: "timescale", label: "Start date or timescale" });
  }

  if (!hasMeasurements(draft)) {
    checks.push({ id: "measurements", label: "Any missing measurements" });
  }

  return checks;
}

export function draftHasInventedPrices(draft: QuotePreparationDraft): boolean {
  const pricedFields = [
    ...draft.labourItems.flatMap((item) => [item.rate, item.lineTotal]),
    ...draft.additionalCosts.flatMap((item) => [item.rate, item.lineTotal]),
    ...draft.materials.map((item) => item.price),
    draft.subtotal,
    draft.vatAmount,
    draft.total,
  ];

  return pricedFields.some((value) => {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== "0" && trimmed !== "0.00";
  });
}
