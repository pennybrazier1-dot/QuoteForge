/**
 * Stage 9I.3c — ledger balance math + Mark as Paid idempotency keys.
 * Empty ledger does NOT mean unpaid: opening_amount_paid preserves pre-ledger counters.
 */

export type LedgerBalanceInput = {
  totalAmountPence: number;
  openingAmountPaidPence: number;
  ledgerSumPence: number;
};

export type LedgerBalanceResult = {
  amountPaidPence: number;
  balanceDuePence: number;
  fullySettled: boolean;
  partiallyPaid: boolean;
};

export function computeLedgerDerivedBalances(
  input: LedgerBalanceInput
): LedgerBalanceResult {
  const total = Math.max(0, Math.round(input.totalAmountPence));
  const opening = Math.max(0, Math.round(input.openingAmountPaidPence));
  const ledger = Math.max(0, Math.round(input.ledgerSumPence));
  const amountPaidPence = Math.min(total, opening + ledger);
  const balanceDuePence = Math.max(0, total - amountPaidPence);
  return {
    amountPaidPence,
    balanceDuePence,
    fullySettled: balanceDuePence === 0 && total >= 0,
    partiallyPaid: amountPaidPence > 0 && balanceDuePence > 0,
  };
}

/** Reject amounts that would overpay the remaining balance. */
export function assertPaymentWithinBalance(
  amountPence: number,
  balanceDuePence: number
): { ok: true } | { ok: false; error: string } {
  const amount = Math.round(amountPence);
  const balance = Math.max(0, Math.round(balanceDuePence));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Payment amount must be greater than zero" };
  }
  if (balance <= 0) {
    return { ok: false, error: "Invoice is already fully paid" };
  }
  if (amount > balance) {
    return {
      ok: false,
      error: `Payment would exceed balance due (${balance} pence remaining)`,
    };
  }
  return { ok: true };
}

/**
 * Stable idempotency key for Mark as Paid / settle-remaining.
 * One key per invoice so retries never create a second remaining-balance row.
 */
export function markRemainingPaymentKey(invoiceId: string): string {
  const id = invoiceId.trim();
  if (!id) {
    throw new Error("markRemainingPaymentKey requires an invoice id.");
  }
  return `mark_remaining/${id}`;
}

export type RecordInvoicePaymentRpcResult = {
  ok: boolean;
  already_recorded?: boolean;
  payment_id?: string;
  invoice_id?: string;
  amount_recorded?: number;
  amount_paid?: number;
  balance_due?: number;
  fully_settled?: boolean;
  proposal_payment_status?: string;
  job_status?: string;
};

export function parseRecordInvoicePaymentRpcResult(
  data: unknown
): RecordInvoicePaymentRpcResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const row = data as Record<string, unknown>;
  if (row.ok !== true) {
    return null;
  }
  return {
    ok: true,
    already_recorded: Boolean(row.already_recorded),
    payment_id: typeof row.payment_id === "string" ? row.payment_id : undefined,
    invoice_id: typeof row.invoice_id === "string" ? row.invoice_id : undefined,
    amount_recorded:
      typeof row.amount_recorded === "number" ? row.amount_recorded : undefined,
    amount_paid:
      typeof row.amount_paid === "number" ? row.amount_paid : undefined,
    balance_due:
      typeof row.balance_due === "number" ? row.balance_due : undefined,
    fully_settled: Boolean(row.fully_settled),
    proposal_payment_status:
      typeof row.proposal_payment_status === "string"
        ? row.proposal_payment_status
        : undefined,
    job_status: typeof row.job_status === "string" ? row.job_status : undefined,
  };
}

/** Stable idempotency key for a confirmed full-remainder waiver attempt. */
export function invoiceWaiverIdempotencyKey(
  invoiceId: string,
  attemptId: string
): string {
  const inv = invoiceId.trim();
  const attempt = attemptId.trim();
  if (!inv || !attempt) {
    throw new Error("invoiceWaiverIdempotencyKey requires invoice and attempt ids.");
  }
  return `waiver/${inv}/${attempt}`;
}

export type RecordInvoiceWaiverRpcResult = {
  ok: boolean;
  already_recorded?: boolean;
  waiver_id?: string;
  invoice_id?: string;
  amount_waived_recorded?: number;
  amount_paid?: number;
  amount_waived?: number;
  balance_due?: number;
  fully_settled?: boolean;
  proposal_payment_status?: string;
  cash_received?: boolean;
};

export function parseRecordInvoiceWaiverRpcResult(
  data: unknown
): RecordInvoiceWaiverRpcResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const row = data as Record<string, unknown>;
  if (row.ok !== true) {
    return null;
  }
  return {
    ok: true,
    already_recorded: Boolean(row.already_recorded),
    waiver_id: typeof row.waiver_id === "string" ? row.waiver_id : undefined,
    invoice_id: typeof row.invoice_id === "string" ? row.invoice_id : undefined,
    amount_waived_recorded:
      typeof row.amount_waived_recorded === "number"
        ? row.amount_waived_recorded
        : undefined,
    amount_paid:
      typeof row.amount_paid === "number" ? row.amount_paid : undefined,
    amount_waived:
      typeof row.amount_waived === "number" ? row.amount_waived : undefined,
    balance_due:
      typeof row.balance_due === "number" ? row.balance_due : undefined,
    fully_settled: Boolean(row.fully_settled),
    proposal_payment_status:
      typeof row.proposal_payment_status === "string"
        ? row.proposal_payment_status
        : undefined,
    cash_received:
      typeof row.cash_received === "boolean" ? row.cash_received : false,
  };
}
