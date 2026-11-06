import { buildCustomerInvoicePdfPath } from "@/lib/proposals/customer-portal/token";

/** Figures stored on the approved invoice. The balance is the saved column. */
export type SavedInvoicePortalAmounts = {
  totalPence: number;
  amountPaidPence: number;
  balanceDuePence: number;
};

function wholePence(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) {
    return null;
  }
  const pence = Math.round(Number(value));
  if (pence < 0) {
    return null;
  }
  return pence;
}

/**
 * Read an approved invoice the way the PDF does: total, amount paid, and
 * balance due are the saved columns. The balance is not recalculated here.
 * A draft returns nothing, so the portal cannot offer it.
 */
export function readApprovedInvoicePortalSnapshot(
  row: {
    status?: string | null;
    total_amount?: number | null;
    amount_paid?: number | null;
    balance_due?: number | null;
  } | null
): SavedInvoicePortalAmounts | null {
  if (!row || row.status !== "approved") {
    return null;
  }
  const totalPence = wholePence(row.total_amount);
  const amountPaidPence = wholePence(row.amount_paid);
  const balanceDuePence = wholePence(row.balance_due);
  if (
    totalPence == null ||
    amountPaidPence == null ||
    balanceDuePence == null
  ) {
    return null;
  }
  // The ledger stores paid + balance as the total. If that is not true,
  // the row is not safe to show as an outstanding amount.
  if (amountPaidPence + balanceDuePence !== totalPence) {
    return null;
  }
  return { totalPence, amountPaidPence, balanceDuePence };
}

/** An approved invoice row whose saved figures cannot be shown safely. */
export function approvedInvoiceFiguresUnavailable(
  row: {
    status?: string | null;
    total_amount?: number | null;
    amount_paid?: number | null;
    balance_due?: number | null;
  } | null
): boolean {
  if (!row || row.status !== "approved") {
    return false;
  }
  return readApprovedInvoicePortalSnapshot(row) == null;
}

/** Customer invoice PDF path. Approved invoices and a real portal token only. */
export function customerApprovedInvoicePdfPath(
  token: string,
  invoiceStatus: string | null | undefined
): string | null {
  if (invoiceStatus !== "approved") {
    return null;
  }
  const trimmed = token.trim();
  if (trimmed.length < 16) {
    return null;
  }
  return buildCustomerInvoicePdfPath(trimmed);
}

/**
 * Download link for an approved invoice on this customer's token.
 * A mismatched balance does not remove the download. It only hides the figures.
 */
export function customerApprovedInvoiceDownloadPath(
  token: string,
  row: { status?: string | null } | null
): string | null {
  if (!row || row.status !== "approved") {
    return null;
  }
  return customerApprovedInvoicePdfPath(token, "approved");
}
