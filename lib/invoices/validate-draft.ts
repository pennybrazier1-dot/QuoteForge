import type {
  InvoiceFlag,
  InvoiceLineItem,
  InvoiceLinePricingState,
} from "@/lib/invoices/types";

export function recalculateInvoiceTotals(input: {
  line_items: InvoiceLineItem[];
  vat_amount: number;
  amount_paid: number;
}): {
  subtotal_amount: number;
  total_amount: number;
  balance_due: number;
} {
  const subtotal = input.line_items.reduce(
    (sum, line) => sum + Math.max(0, Math.round(line.total_amount)),
    0
  );
  const vat = Math.max(0, Math.round(input.vat_amount));
  const total = subtotal + vat;
  const paid = Math.max(0, Math.round(input.amount_paid));
  return {
    subtotal_amount: subtotal,
    total_amount: total,
    balance_due: Math.max(0, total - paid),
  };
}

export type InvoiceValidationInput = {
  line_items: InvoiceLineItem[];
  vat_amount: number;
  amount_paid: number;
  agreed_total_amount: number;
  source_vat_amount: number;
  adjustment_confirmed: boolean;
  tax_confirmed: boolean;
  notes?: string | null;
};

export type InvoiceValidationResult = {
  flags: InvoiceFlag[];
  errors: string[];
  canApprove: boolean;
  subtotal_amount: number;
  total_amount: number;
  balance_due: number;
};

export function normalizeLinePricingState(
  line: Pick<
    InvoiceLineItem,
    "total_amount" | "pricing_state" | "kind"
  >
): InvoiceLinePricingState {
  if (line.total_amount > 0) {
    return "priced";
  }
  if (line.pricing_state === "zero_confirmed") {
    return "zero_confirmed";
  }
  if (line.pricing_state === "included_unpriced") {
    return "included_unpriced";
  }
  // Legacy / labour zero rows: treat positive-priced kinds as priced-at-zero
  // only when explicitly confirmed; otherwise require confirmation.
  if (line.kind === "labour") {
    return "priced";
  }
  return line.pricing_state === "priced"
    ? "included_unpriced"
    : line.pricing_state;
}

export function withNormalizedPricingStates(
  lines: InvoiceLineItem[]
): InvoiceLineItem[] {
  return lines.map((line) => ({
    ...line,
    pricing_state: normalizeLinePricingState(line),
  }));
}

/**
 * Derive safety flags and approve/save errors for an invoice draft.
 * Never invents tax or prices — only validates what the trader confirmed.
 */
export function validateInvoiceDraft(
  input: InvoiceValidationInput
): InvoiceValidationResult {
  const lines = withNormalizedPricingStates(input.line_items);
  const totals = recalculateInvoiceTotals({
    line_items: lines,
    vat_amount: input.vat_amount,
    amount_paid: input.amount_paid,
  });

  const flags: InvoiceFlag[] = [];
  const errors: string[] = [];

  if (totals.total_amount <= 0) {
    flags.push("missing_total");
    errors.push("Set a total before approving this invoice.");
  }

  const unconfirmedZeros = lines.filter(
    (line) =>
      line.total_amount === 0 && line.pricing_state === "included_unpriced"
  );
  if (unconfirmedZeros.length > 0) {
    flags.push("unconfirmed_zero_lines");
    flags.push("missing_line_prices");
    errors.push(
      "Confirm each £0 material or extra as free/included, or enter a price."
    );
  }

  const agreed = Math.max(0, Math.round(input.agreed_total_amount));
  if (agreed > 0 && totals.total_amount !== agreed) {
    flags.push("total_differs_from_agreed");
    const note = (input.notes ?? "").trim();
    if (!input.adjustment_confirmed || !note) {
      errors.push(
        "Invoice total differs from the agreed quote. Confirm the adjustment and add a short note."
      );
    }
  }

  const sourceVat = Math.max(0, Math.round(input.source_vat_amount));
  const vat = Math.max(0, Math.round(input.vat_amount));
  if (vat > 0 && sourceVat === 0 && !input.tax_confirmed) {
    flags.push("tax_unconfirmed");
    errors.push(
      "Confirm the VAT amount — it was not stored on the original quote."
    );
  }

  return {
    flags: [...new Set(flags)],
    errors,
    canApprove: errors.length === 0,
    subtotal_amount: totals.subtotal_amount,
    total_amount: totals.total_amount,
    balance_due: totals.balance_due,
  };
}

export function validateInvoiceForApproval(
  input: InvoiceValidationInput
): InvoiceValidationResult {
  return validateInvoiceDraft(input);
}

export function invoiceFlagMessages(flags: InvoiceFlag[]): string[] {
  const messages: string[] = [];
  if (flags.includes("missing_total")) {
    messages.push("This draft has no total yet. Enter the agreed amount.");
  }
  if (
    flags.includes("unconfirmed_zero_lines") ||
    flags.includes("missing_line_prices")
  ) {
    messages.push(
      "Some materials or extras are £0. Confirm they are free/included, or enter a price — do not leave placeholders unresolved."
    );
  }
  if (flags.includes("total_differs_from_agreed")) {
    messages.push(
      "The invoice total differs from the agreed quote. Confirm the adjustment before approving."
    );
  }
  if (flags.includes("tax_unconfirmed")) {
    messages.push(
      "VAT was added but was not on the original quote. Confirm the tax amount."
    );
  }
  return messages;
}
