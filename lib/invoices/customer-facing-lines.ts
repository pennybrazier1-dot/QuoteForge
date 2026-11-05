import type { InvoiceLineItem } from "@/lib/invoices/types";

/**
 * Draft-suggestion placeholders from quote preparation must not appear on
 * customer-facing invoice PDFs. Legitimate £0 lines (e.g. included travel)
 * are preserved when they are not draft-suggestion wording.
 */
export function isDraftSuggestionInvoiceLine(
  line: Pick<InvoiceLineItem, "description" | "unit_amount" | "total_amount">
): boolean {
  const description = line.description?.trim() ?? "";
  if (!description) {
    return false;
  }

  if (/^draft\s+suggestion\s*:/i.test(description)) {
    return true;
  }

  // Unpriced quote-prep placeholders that were never replaced with real lines.
  const looksLikeTbcPlaceholder =
    /prices?\s+to\s+be\s+confirmed/i.test(description) ||
    /to\s+be\s+confirmed/i.test(description);
  const isZero =
    Math.round(Number(line.unit_amount ?? 0)) === 0 &&
    Math.round(Number(line.total_amount ?? 0)) === 0;

  return looksLikeTbcPlaceholder && isZero;
}

/** True when a materials/extras string from a proposal is still a draft suggestion. */
export function isDraftSuggestionMaterialDescription(description: string): boolean {
  return isDraftSuggestionInvoiceLine({
    description,
    unit_amount: 0,
    total_amount: 0,
  });
}

export function customerFacingInvoiceLineItems(
  lines: InvoiceLineItem[]
): InvoiceLineItem[] {
  return lines.filter((line) => !isDraftSuggestionInvoiceLine(line));
}
