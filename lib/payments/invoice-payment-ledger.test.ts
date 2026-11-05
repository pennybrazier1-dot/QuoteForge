import { describe, expect, it } from "vitest";
import {
  assertPaymentWithinBalance,
  computeLedgerDerivedBalances,
  markRemainingPaymentKey,
} from "@/lib/payments/invoice-payment-ledger";
import { PAYMENT_STATUS_LABELS } from "@/lib/payments/job-payment";
import { isPaymentStatus, PAYMENT_STATUSES } from "@/lib/payments/types";
import {
  canCloseJob,
  canMarkPaymentPaid,
  canRecordInvoicePayment,
  canRequestPayment,
  poundsInputToPence,
} from "@/lib/payments/job-payment";

describe("computeLedgerDerivedBalances", () => {
  it("keeps historical fully paid with empty ledger via opening balance", () => {
    const result = computeLedgerDerivedBalances({
      totalAmountPence: 152000,
      openingAmountPaidPence: 152000,
      ledgerSumPence: 0,
    });
    expect(result).toEqual({
      amountPaidPence: 152000,
      balanceDuePence: 0,
      fullySettled: true,
      partiallyPaid: false,
    });
  });

  it("treats unpaid + empty ledger as unpaid (opening 0)", () => {
    const result = computeLedgerDerivedBalances({
      totalAmountPence: 240000,
      openingAmountPaidPence: 0,
      ledgerSumPence: 0,
    });
    expect(result.amountPaidPence).toBe(0);
    expect(result.balanceDuePence).toBe(240000);
    expect(result.fullySettled).toBe(false);
  });

  it("applies deposit then instalments on a £2400 invoice", () => {
    const total = 240000;
    const opening = 0;
    let ledger = 0;

    ledger += 60000;
    let bal = computeLedgerDerivedBalances({
      totalAmountPence: total,
      openingAmountPaidPence: opening,
      ledgerSumPence: ledger,
    });
    expect(bal.amountPaidPence).toBe(60000);
    expect(bal.balanceDuePence).toBe(180000);
    expect(bal.partiallyPaid).toBe(true);

    ledger += 80000;
    bal = computeLedgerDerivedBalances({
      totalAmountPence: total,
      openingAmountPaidPence: opening,
      ledgerSumPence: ledger,
    });
    expect(bal.amountPaidPence).toBe(140000);
    expect(bal.balanceDuePence).toBe(100000);

    ledger += 100000;
    bal = computeLedgerDerivedBalances({
      totalAmountPence: total,
      openingAmountPaidPence: opening,
      ledgerSumPence: ledger,
    });
    expect(bal.amountPaidPence).toBe(240000);
    expect(bal.balanceDuePence).toBe(0);
    expect(bal.fullySettled).toBe(true);
  });

  it("preserves opening partial counters without inventing ledger rows", () => {
    const result = computeLedgerDerivedBalances({
      totalAmountPence: 100000,
      openingAmountPaidPence: 25000,
      ledgerSumPence: 10000,
    });
    expect(result.amountPaidPence).toBe(35000);
    expect(result.balanceDuePence).toBe(65000);
    expect(result.partiallyPaid).toBe(true);
  });
});

describe("markRemainingPaymentKey", () => {
  it("is stable per invoice for Mark as Paid retries", () => {
    expect(markRemainingPaymentKey("inv-1")).toBe("mark_remaining/inv-1");
    expect(markRemainingPaymentKey("inv-1")).toBe(
      markRemainingPaymentKey("inv-1")
    );
  });
});

describe("assertPaymentWithinBalance", () => {
  it("rejects zero, negative, overpay, and already-paid", () => {
    expect(assertPaymentWithinBalance(0, 100).ok).toBe(false);
    expect(assertPaymentWithinBalance(-1, 100).ok).toBe(false);
    expect(assertPaymentWithinBalance(101, 100).ok).toBe(false);
    expect(assertPaymentWithinBalance(50, 0).ok).toBe(false);
    expect(assertPaymentWithinBalance(100, 100).ok).toBe(true);
  });
});

describe("partially_paid lifecycle consumers", () => {
  it("includes partially_paid in payment status enum and labels", () => {
    expect(PAYMENT_STATUSES).toContain("partially_paid");
    expect(isPaymentStatus("partially_paid")).toBe(true);
    expect(PAYMENT_STATUS_LABELS.partially_paid).toBe("Partially paid");
  });

  it("allows Mark as Paid and instalment re-request while outstanding, but not close", () => {
    expect(
      canCloseJob({ jobStatus: "completed", paymentStatus: "partially_paid" })
    ).toBe(false);
    expect(
      canMarkPaymentPaid({
        jobStatus: "completed",
        paymentStatus: "partially_paid",
      })
    ).toBe(true);
    expect(
      canRequestPayment({
        jobStatus: "completed",
        paymentStatus: "partially_paid",
        hasApprovedInvoice: true,
        balanceDuePence: 180000,
      })
    ).toBe(true);
    expect(
      canRequestPayment({
        jobStatus: "completed",
        paymentStatus: "partially_paid",
        hasApprovedInvoice: true,
        balanceDuePence: 0,
      })
    ).toBe(false);
    expect(
      canRequestPayment({
        jobStatus: "completed",
        paymentStatus: "paid",
        hasApprovedInvoice: true,
        balanceDuePence: 0,
      })
    ).toBe(false);
  });

  it("allows Record Payment only with approved invoice balance remaining", () => {
    expect(
      canRecordInvoicePayment({
        jobStatus: "completed",
        paymentStatus: "requested",
        hasApprovedInvoice: true,
        balanceDuePence: 180000,
      })
    ).toBe(true);
    expect(
      canRecordInvoicePayment({
        jobStatus: "completed",
        paymentStatus: "paid",
        hasApprovedInvoice: true,
        balanceDuePence: 0,
      })
    ).toBe(false);
    expect(
      canRecordInvoicePayment({
        jobStatus: "completed",
        paymentStatus: "requested",
        hasApprovedInvoice: false,
        balanceDuePence: 10000,
      })
    ).toBe(false);
  });

  it("parses pounds input to pence safely", () => {
    expect(poundsInputToPence("600.00")).toBe(60000);
    expect(poundsInputToPence("0")).toBeNull();
    expect(poundsInputToPence("abc")).toBeNull();
    expect(poundsInputToPence("10.999")).toBeNull();
  });
});
