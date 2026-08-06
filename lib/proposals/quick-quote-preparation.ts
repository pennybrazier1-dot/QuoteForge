import { formatPenceForInput, parsePriceToPence } from "@/lib/proposals/money";

export type QuickQuoteConfirmItem = {
  id: string;
  label: string;
};

/** Manual checklist — traders tick items they have covered. Not an enquiry form. */
export const QUICK_QUOTE_CONFIRM_ITEMS: QuickQuoteConfirmItem[] = [
  { id: "measurements", label: "Measurements" },
  { id: "materials", label: "Materials / specification" },
  { id: "labour", label: "Labour estimate" },
  { id: "duration", label: "Duration" },
  { id: "start_date", label: "Start date" },
  { id: "access", label: "Access requirements" },
  { id: "expectations", label: "Customer expectations" },
];

export type QuickQuoteConfirmState = Record<string, boolean>;

export function createEmptyConfirmState(): QuickQuoteConfirmState {
  return Object.fromEntries(
    QUICK_QUOTE_CONFIRM_ITEMS.map((item) => [item.id, false])
  );
}

/** Labels the trader has not yet ticked — useful context for the proposal draft. */
export function getUnconfirmedLabels(
  confirmed: QuickQuoteConfirmState
): string[] {
  return QUICK_QUOTE_CONFIRM_ITEMS.filter((item) => !confirmed[item.id]).map(
    (item) => item.label
  );
}

export function sumQuickQuoteCosts(
  materials: string,
  labour: string,
  additional: string
): string {
  const amounts = [materials, labour, additional].map((value) =>
    parsePriceToPence(value)
  );

  if (amounts.some((amount) => amount === null)) {
    return "";
  }

  const hasAny = [materials, labour, additional].some((value) =>
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
 * Packs prep notes + open checklist items into the existing optionalExtras
 * field used by generate/save — no new DB columns.
 */
export function buildQuickQuoteOptionalExtras(options: {
  notes: string;
  confirmed: QuickQuoteConfirmState;
  materials: string;
  labour: string;
  additional: string;
}): string {
  const parts: string[] = [];
  const notes = options.notes.trim();
  if (notes) {
    parts.push(notes);
  }

  const open = getUnconfirmedLabels(options.confirmed);
  if (open.length > 0) {
    parts.push(`Still to confirm: ${open.join("; ")}.`);
  }

  const pricingBits = [
    options.materials.trim()
      ? `Materials: £${options.materials.trim()}`
      : null,
    options.labour.trim() ? `Labour: £${options.labour.trim()}` : null,
    options.additional.trim()
      ? `Additional: £${options.additional.trim()}`
      : null,
  ].filter(Boolean);

  if (pricingBits.length > 0) {
    parts.push(`Pricing notes — ${pricingBits.join("; ")}.`);
  }

  return parts.join("\n\n");
}
