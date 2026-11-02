import { describe, expect, it } from "vitest";
import type { InvoiceLineItem } from "@/lib/invoices/types";
import {
  validateInvoiceDraft,
  validateInvoiceForApproval,
} from "@/lib/invoices/validate-draft";

function labourLine(amount: number): InvoiceLineItem {
  return {
    id: "labour-1",
    kind: "labour",
    description: "Labour",
    quantity: 1,
    unit_amount: amount,
    total_amount: amount,
    pricing_state: "priced",
  };
}

function materialUnpriced(description: string): InvoiceLineItem {
  return {
    id: `mat-${description}`,
    kind: "materials",
    description,
    quantity: 1,
    unit_amount: 0,
    total_amount: 0,
    pricing_state: "included_unpriced",
  };
}

describe("validateInvoiceDraft", () => {
  it("blocks approval while material placeholders are unconfirmed", () => {
    const result = validateInvoiceForApproval({
      line_items: [labourLine(22000), materialUnpriced("Outdoor tap")],
      vat_amount: 0,
      amount_paid: 0,
      agreed_total_amount: 22000,
      source_vat_amount: 0,
      adjustment_confirmed: false,
      tax_confirmed: false,
    });

    expect(result.canApprove).toBe(false);
    expect(result.flags).toContain("unconfirmed_zero_lines");
    expect(result.flags).toContain("missing_line_prices");
    expect(result.total_amount).toBe(22000);
  });

  it("allows approval after confirming zero-cost materials and matching agreed total", () => {
    const result = validateInvoiceForApproval({
      line_items: [
        labourLine(22000),
        {
          ...materialUnpriced("Outdoor tap"),
          pricing_state: "zero_confirmed",
        },
      ],
      vat_amount: 0,
      amount_paid: 0,
      agreed_total_amount: 22000,
      source_vat_amount: 0,
      adjustment_confirmed: false,
      tax_confirmed: false,
    });

    expect(result.canApprove).toBe(true);
    expect(result.flags).not.toContain("unconfirmed_zero_lines");
    expect(result.total_amount).toBe(22000);
  });

  it("flags double-charge style totals that differ from the agreed quote", () => {
    const result = validateInvoiceDraft({
      line_items: [
        labourLine(22000),
        {
          id: "mat-1",
          kind: "materials",
          description: "Tap",
          quantity: 1,
          unit_amount: 2000,
          total_amount: 2000,
          pricing_state: "priced",
        },
      ],
      vat_amount: 0,
      amount_paid: 0,
      agreed_total_amount: 22000,
      source_vat_amount: 0,
      adjustment_confirmed: false,
      tax_confirmed: false,
    });

    expect(result.total_amount).toBe(24000);
    expect(result.flags).toContain("total_differs_from_agreed");
    expect(result.canApprove).toBe(false);
  });

  it("allows adjusted totals only with confirmation and a note", () => {
    const adjustedLines: InvoiceLineItem[] = [
      labourLine(22000),
      {
        id: "mat-1",
        kind: "materials",
        description: "Tap",
        quantity: 1,
        unit_amount: 2000,
        total_amount: 2000,
        pricing_state: "priced",
      },
    ];

    const blocked = validateInvoiceForApproval({
      line_items: adjustedLines,
      vat_amount: 0,
      amount_paid: 0,
      agreed_total_amount: 22000,
      source_vat_amount: 0,
      adjustment_confirmed: true,
      tax_confirmed: false,
      notes: "",
    });
    expect(blocked.total_amount).toBe(24000);
    expect(blocked.canApprove).toBe(false);

    const allowed = validateInvoiceForApproval({
      line_items: adjustedLines,
      vat_amount: 0,
      amount_paid: 0,
      agreed_total_amount: 22000,
      source_vat_amount: 0,
      adjustment_confirmed: true,
      tax_confirmed: false,
      notes: "Customer added extra materials on site",
    });
    expect(allowed.canApprove).toBe(true);
  });

  it("never invents tax but blocks unconfirmed added VAT", () => {
    const result = validateInvoiceForApproval({
      line_items: [
        labourLine(22000),
        {
          ...materialUnpriced("Tap"),
          pricing_state: "zero_confirmed",
        },
      ],
      vat_amount: 4400,
      amount_paid: 0,
      agreed_total_amount: 26400,
      source_vat_amount: 0,
      adjustment_confirmed: true,
      tax_confirmed: false,
      notes: "Added VAT",
    });

    expect(result.flags).toContain("tax_unconfirmed");
    expect(result.canApprove).toBe(false);

    const confirmed = validateInvoiceForApproval({
      line_items: [
        labourLine(22000),
        {
          ...materialUnpriced("Tap"),
          pricing_state: "zero_confirmed",
        },
      ],
      vat_amount: 4400,
      amount_paid: 0,
      agreed_total_amount: 26400,
      source_vat_amount: 0,
      adjustment_confirmed: true,
      tax_confirmed: true,
      notes: "Added VAT",
    });
    expect(confirmed.canApprove).toBe(true);
  });

  it("deducts recorded payments in balance due", () => {
    const result = validateInvoiceDraft({
      line_items: [
        labourLine(22000),
        {
          ...materialUnpriced("Tap"),
          pricing_state: "zero_confirmed",
        },
      ],
      vat_amount: 0,
      amount_paid: 5000,
      agreed_total_amount: 22000,
      source_vat_amount: 0,
      adjustment_confirmed: false,
      tax_confirmed: false,
    });

    expect(result.total_amount).toBe(22000);
    expect(result.balance_due).toBe(17000);
    expect(result.canApprove).toBe(true);
  });
});
