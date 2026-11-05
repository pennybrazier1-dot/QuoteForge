/**
 * Part 3F — thin partial-payment trader UI contracts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canCloseJob,
  canMarkPaymentPaid,
  canRecordInvoicePayment,
  poundsInputToPence,
} from "@/lib/payments/job-payment";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Part 3F thin partial-payment UI", () => {
  it("wires recordInvoicePaymentAction with stable idempotency and no CN/refund deps", () => {
    const ui = readRepo("components/jobs/completed-job-payment.tsx");
    expect(ui).toContain("recordInvoicePaymentAction");
    expect(ui).toContain('name="idempotencyKey"');
    expect(ui).toContain("newRecordIdempotencyKey");
    expect(ui).toContain("manual/${invoiceId}/");
    expect(ui).toContain("canRecordInvoicePayment");
    expect(ui).toContain("Invoice total");
    expect(ui).toContain("Already paid");
    expect(ui).toContain("Outstanding");
    expect(ui).toContain("Only record");
    expect(ui).toContain("does not collect payment");
    expect(ui).toContain("Close job");
    expect(ui).not.toContain("credit-notes");
    expect(ui).not.toContain("remainingCreditablePence");
    expect(ui).not.toContain("refund");
    expect(ui).not.toContain("deriveInvoiceSettlement");
    expect(ui).not.toContain("notify-invoice-issued");
    expect(ui).not.toContain("lib/invoices/pdf");
  });

  it("keeps page/workspace integration for payment_panel", () => {
    const page = readRepo("app/(workspace)/proposals/[id]/page.tsx");
    const workspace = readRepo("components/proposals/proposal-workspace.tsx");
    expect(page).toContain("loadInvoicePaymentPanel");
    expect(page).toContain("payment_panel: paymentPanel");
    expect(workspace).toContain("payment_panel?");
    expect(workspace).toContain("paymentPanel={proposal.payment_panel");
  });

  it("loads thin panel without waiver/credit/refund columns", () => {
    const loader = readRepo("lib/payments/load-invoice-payment-panel.ts");
    expect(loader).toContain("balance_due");
    expect(loader).toContain("amount_paid");
    expect(loader).toContain("invoice_payments");
    expect(loader).not.toContain("amount_waived");
    expect(loader).not.toContain("amount_credited");
    expect(loader).not.toContain("loadInvoiceRefunds");
    expect(loader).not.toContain("credit-notes");
  });
});

describe("Part 3F eligibility and amount guards", () => {
  it("allows recording only with approved invoice outstanding balance", () => {
    expect(
      canRecordInvoicePayment({
        jobStatus: "completed",
        paymentStatus: "requested",
        closedAt: null,
        balanceDuePence: 80_000,
        hasApprovedInvoice: true,
      })
    ).toBe(true);
    expect(
      canRecordInvoicePayment({
        jobStatus: "completed",
        paymentStatus: "partially_paid",
        closedAt: null,
        balanceDuePence: 50_000,
        hasApprovedInvoice: true,
      })
    ).toBe(true);
    expect(
      canRecordInvoicePayment({
        jobStatus: "completed",
        paymentStatus: "paid",
        closedAt: null,
        balanceDuePence: 0,
        hasApprovedInvoice: true,
      })
    ).toBe(false);
    expect(
      canRecordInvoicePayment({
        jobStatus: "completed",
        paymentStatus: "requested",
        closedAt: null,
        balanceDuePence: 80_000,
        hasApprovedInvoice: false,
      })
    ).toBe(false);
  });

  it("keeps Paid separate from Closed", () => {
    expect(
      canCloseJob({
        jobStatus: "completed",
        paymentStatus: "paid",
        closedAt: null,
      })
    ).toBe(true);
    expect(
      canCloseJob({
        jobStatus: "completed",
        paymentStatus: "partially_paid",
        closedAt: null,
      })
    ).toBe(false);
    expect(
      canMarkPaymentPaid({
        jobStatus: "completed",
        paymentStatus: "partially_paid",
        closedAt: null,
        balanceDuePence: 50_000,
        hasApprovedInvoice: true,
      })
    ).toBe(true);
  });

  it("parses pounds to pence and rejects zero/negative/excess-format", () => {
    expect(poundsInputToPence("200.00")).toBe(20_000);
    expect(poundsInputToPence("0")).toBeNull();
    expect(poundsInputToPence("-1")).toBeNull();
    expect(poundsInputToPence("abc")).toBeNull();
    expect(poundsInputToPence("10.001")).toBeNull();
  });
});

describe("Part 3F notification and ledger action contracts", () => {
  it("recordInvoicePaymentAction uses RPC idempotency and received notify options", () => {
    const actions = readRepo("lib/payments/actions.ts");
    const slice = actions.slice(
      actions.indexOf("export async function recordInvoicePaymentAction"),
      actions.indexOf("export async function markJobPaidAction")
    );
    expect(slice).toContain("p_idempotency_key: idempotencyKey");
    expect(slice).toContain("record_invoice_payment");
    expect(slice).toContain("safeNotifyPaymentReceived");
    expect(slice).toContain("ledgerPaymentId: parsed.payment_id");
    expect(slice).toContain("outstandingPence: parsed.balance_due");
    expect(slice).toContain("fullySettled: Boolean(parsed.fully_settled)");
    expect(slice).toContain("already_recorded");
    expect(slice).not.toContain("closeJobAction");
    expect(slice).not.toContain('status: "closed"');
  });
});
