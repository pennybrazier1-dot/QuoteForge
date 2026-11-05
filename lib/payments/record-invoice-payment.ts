import type { PaymentMethod } from "@/lib/payments/types";
import { isPaymentMethod, parsePaymentMethods } from "@/lib/payments/types";

/**
 * Prefer bank transfer when the trader issued it; otherwise the first issued method.
 * Never invents a method that was not on the payment request.
 */
export function resolveRecordedPaymentMethod(
  issuedMethods: string[] | null | undefined
): PaymentMethod {
  const methods = parsePaymentMethods(issuedMethods);
  if (methods.includes("bank_transfer")) {
    return "bank_transfer";
  }
  const first = methods[0];
  return first && isPaymentMethod(first) ? first : "other";
}

export type InvoicePaymentSnapshot = {
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
};

/**
 * Full settlement against an approved invoice for a recorded job payment.
 * Preserves priced totals; only amount_paid / balance_due change.
 * Idempotent when the invoice is already fully paid.
 */
export function applyFullPaymentToInvoice(
  invoice: InvoicePaymentSnapshot,
  dueAmountPence: number | null | undefined
):
  | { ok: true; alreadyPaid: true; amount_paid: number; balance_due: number }
  | {
      ok: true;
      alreadyPaid: false;
      amount_paid: number;
      balance_due: number;
    }
  | { ok: false; error: string } {
  if (invoice.status !== "approved") {
    return {
      ok: false,
      error: "Only an approved invoice can record payment.",
    };
  }

  const total = Math.max(0, Math.round(invoice.total_amount));
  const currentPaid = Math.max(0, Math.round(invoice.amount_paid));
  const currentBalance = Math.max(0, Math.round(invoice.balance_due));

  if (currentBalance === 0 && currentPaid >= total && total > 0) {
    return {
      ok: true,
      alreadyPaid: true,
      amount_paid: currentPaid,
      balance_due: 0,
    };
  }
  if (currentBalance === 0 && total === 0) {
    return {
      ok: true,
      alreadyPaid: true,
      amount_paid: currentPaid,
      balance_due: 0,
    };
  }

  // Full settlement only — do not invent partial payments.
  // Prefer the requested due amount when it matches the invoice total;
  // otherwise settle the approved invoice total.
  const due =
    dueAmountPence != null && dueAmountPence > 0
      ? Math.round(dueAmountPence)
      : total;
  const settledPaid = due === total ? due : total;

  return {
    ok: true,
    alreadyPaid: false,
    amount_paid: settledPaid,
    balance_due: Math.max(0, total - settledPaid),
  };
}
