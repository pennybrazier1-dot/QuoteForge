import { describe, expect, it } from "vitest";
import {
  buildInvoiceDraftFromProposal,
  recalculateInvoiceTotals,
} from "@/lib/invoices/build-draft-from-proposal";

describe("buildInvoiceDraftFromProposal", () => {
  it("copies labour total and materials without inventing material prices or double-charging", () => {
    const draft = buildInvoiceDraftFromProposal({
      id: "p1",
      workspace_id: "w1",
      title: "Outdoor tap",
      job_summary: "Fit outdoor tap",
      labour_description: "Fit outdoor tap and check for leaks",
      materials: ["Outdoor tap", "Sealing materials"],
      ai_optional_extras: ["Extra pipe lagging"],
      total_amount: 22000,
      vat_amount: 0,
      subtotal_amount: 22000,
      currency: "GBP",
      payment_status: "not_requested",
    });

    expect(draft.total_amount).toBe(22000);
    expect(draft.agreed_total_amount).toBe(22000);
    expect(draft.source_vat_amount).toBe(0);
    expect(draft.balance_due).toBe(22000);
    expect(draft.amount_paid).toBe(0);
    expect(draft.line_items[0]?.kind).toBe("labour");
    expect(draft.line_items[0]?.total_amount).toBe(22000);
    expect(draft.line_items[0]?.pricing_state).toBe("priced");

    const materialLines = draft.line_items.filter(
      (line) => line.kind === "materials"
    );
    expect(materialLines).toHaveLength(2);
    expect(materialLines.every((line) => line.total_amount === 0)).toBe(true);
    expect(
      materialLines.every((line) => line.pricing_state === "included_unpriced")
    ).toBe(true);

    // Line sum equals labour only — materials are description placeholders.
    const lineSum = draft.line_items.reduce(
      (sum, line) => sum + line.total_amount,
      0
    );
    expect(lineSum).toBe(22000);
    expect(draft.flags).toContain("unconfirmed_zero_lines");
    expect(draft.flags).toContain("missing_line_prices");
    expect(draft.work_description).toBe("Fit outdoor tap");
  });

  it("includes recorded payments in amount paid and balance", () => {
    const draft = buildInvoiceDraftFromProposal({
      id: "p1",
      workspace_id: "w1",
      title: "Outdoor tap",
      total_amount: 22000,
      payment_status: "paid",
      payment_due_amount: 22000,
    });
    expect(draft.amount_paid).toBe(22000);
    expect(draft.balance_due).toBe(0);
  });

  it("does not invent VAT when vat_amount is zero", () => {
    const draft = buildInvoiceDraftFromProposal({
      id: "p1",
      workspace_id: "w1",
      title: "Outdoor tap",
      total_amount: 22000,
      vat_amount: 0,
    });
    expect(draft.vat_amount).toBe(0);
    expect(draft.source_vat_amount).toBe(0);
  });

  it("copies stored VAT without inventing a rate", () => {
    const draft = buildInvoiceDraftFromProposal({
      id: "p1",
      workspace_id: "w1",
      title: "Outdoor tap",
      total_amount: 24000,
      subtotal_amount: 20000,
      vat_amount: 4000,
    });
    expect(draft.vat_amount).toBe(4000);
    expect(draft.source_vat_amount).toBe(4000);
    expect(draft.subtotal_amount).toBe(20000);
    expect(draft.agreed_total_amount).toBe(24000);
  });

  it("flags missing total when no amount is available", () => {
    const draft = buildInvoiceDraftFromProposal({
      id: "p1",
      workspace_id: "w1",
      title: "Outdoor tap",
      total_amount: 0,
      vat_amount: 0,
      subtotal_amount: 0,
    });
    expect(draft.flags).toContain("missing_total");
  });

  it("recalculates totals from line items", () => {
    const totals = recalculateInvoiceTotals({
      line_items: [
        {
          id: "1",
          kind: "labour",
          description: "Labour",
          quantity: 1,
          unit_amount: 20000,
          total_amount: 20000,
          pricing_state: "priced",
        },
        {
          id: "2",
          kind: "materials",
          description: "Tap",
          quantity: 1,
          unit_amount: 2000,
          total_amount: 2000,
          pricing_state: "priced",
        },
      ],
      vat_amount: 4400,
      amount_paid: 5000,
    });
    expect(totals.subtotal_amount).toBe(22000);
    expect(totals.total_amount).toBe(26400);
    expect(totals.balance_due).toBe(21400);
  });
});
