import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyFullPaymentToInvoice,
  resolveRecordedPaymentMethod,
} from "@/lib/payments/record-invoice-payment";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Stage 9B invoice payment recording", () => {
  it("prefers bank_transfer when it was issued on the request", () => {
    expect(
      resolveRecordedPaymentMethod(["cash", "bank_transfer"])
    ).toBe("bank_transfer");
    expect(resolveRecordedPaymentMethod(["cash"])).toBe("cash");
    expect(resolveRecordedPaymentMethod([])).toBe("other");
  });

  it("settles an approved invoice in full without inventing partials", () => {
    const result = applyFullPaymentToInvoice(
      {
        status: "approved",
        total_amount: 159000,
        amount_paid: 0,
        balance_due: 159000,
      },
      159000
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyPaid).toBe(false);
      expect(result.amount_paid).toBe(159000);
      expect(result.balance_due).toBe(0);
    }
  });

  it("is idempotent when the invoice is already fully paid", () => {
    const result = applyFullPaymentToInvoice(
      {
        status: "approved",
        total_amount: 159000,
        amount_paid: 159000,
        balance_due: 0,
      },
      159000
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyPaid).toBe(true);
      expect(result.amount_paid).toBe(159000);
      expect(result.balance_due).toBe(0);
    }
  });

  it("rejects payment against a draft invoice", () => {
    const result = applyFullPaymentToInvoice(
      {
        status: "draft",
        total_amount: 159000,
        amount_paid: 0,
        balance_due: 159000,
      },
      159000
    );
    expect(result.ok).toBe(false);
  });

  it("keeps approved line totals immutable while allowing paid balances", () => {
    const migration = readRepo(
      "supabase/migrations/20261105010000_invoice_payment_recording.sql"
    );
    expect(migration).toContain("prevent_approved_invoice_rewrite");
    expect(migration).toContain("new.line_items is distinct from old.line_items");
    expect(migration).toContain("new.total_amount is distinct from old.total_amount");
    expect(migration).not.toMatch(
      /new\.amount_paid is distinct from old\.amount_paid/
    );
    expect(migration).not.toMatch(
      /new\.balance_due is distinct from old\.balance_due/
    );
    expect(readRepo("lib/payments/actions.ts")).toContain(
      "ensurePaidInvoiceAndJob"
    );
    expect(readRepo("lib/payments/ensure-paid-lifecycle.ts")).toContain(
      "record_invoice_payment"
    );
    expect(readRepo("lib/payments/ensure-paid-lifecycle.ts")).toContain(
      "markRemainingPaymentKey"
    );
    expect(readRepo("lib/payments/ensure-paid-lifecycle.ts")).not.toContain(
      "applyFullPaymentToInvoice"
    );
    expect(
      readRepo(
        "supabase/migrations/20261109020000_invoice_payment_writer_cutover.sql"
      )
    ).toContain("prevent_direct_approved_invoice_balance_write");
  });

  /**
   * Thin Lifecycle restores Part 2J deferred action/ensure-paid wiring asserts.
   * Payment-notification (`safeNotifyPaymentReceived`) remains deferred to the
   * payment-notify batch. Thin B2 outbound recovery-UI obligation is separate.
   */
  it("wires mark-paid through ledger RPC without closing the job", () => {
    const actions = readRepo("lib/payments/actions.ts");
    const markPaid = actions.slice(
      actions.indexOf("export async function markJobPaidAction"),
      actions.indexOf("export async function waiveJobPaymentAction")
    );
    expect(markPaid).toContain("ensurePaidInvoiceAndJob");
    expect(markPaid).toContain("paymentMethodsIssued");
    expect(markPaid).toContain('payment_status === "paid"');
    expect(markPaid).not.toContain("safeNotifyPaymentReceived");
    expect(markPaid).not.toContain('status: "closed"');
    expect(markPaid).not.toContain("applyFullPaymentToInvoice");
    expect(actions).toContain("export async function closeJobAction");
    expect(actions).toContain("export async function recordInvoicePaymentAction");
    expect(actions).toContain("record_invoice_payment");
  });

  it("ledger RPC sets job paid without closing the job", () => {
    const cutover = readRepo(
      "supabase/migrations/20261109020000_invoice_payment_writer_cutover.sql"
    );
    expect(cutover).toMatch(/v_job_status\s*:=\s*'paid'/);
    expect(cutover).toMatch(
      /update public\.jobs\s+set\s+status = v_job_status,\s+updated_at = now\(\)/
    );
    expect(cutover).not.toMatch(
      /update public\.jobs[\s\S]{0,200}closed_at\s*=/
    );
  });
});
