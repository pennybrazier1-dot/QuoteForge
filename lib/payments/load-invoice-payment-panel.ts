import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPaymentMethod } from "@/lib/payments/job-payment";
import type { PaymentMethod } from "@/lib/payments/types";

/**
 * Thin approved-invoice payment panel data for trader partial-payment UI.
 * Intentionally excludes credit-note, waiver and cash-back aggregates.
 */
export type InvoicePaymentLedgerEntry = {
  id: string;
  amountPence: number;
  paidOn: string;
  method: PaymentMethod | string;
  methodLabel: string;
  reference: string | null;
  note: string | null;
  recordedAt: string;
};

export type InvoicePaymentPanelData = {
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  totalAmountPence: number;
  amountPaidPence: number;
  balanceDuePence: number;
  /** True when fully paid via opening snapshot with no ledger rows. */
  legacyFullyPaidWithoutLedger: boolean;
  entries: InvoicePaymentLedgerEntry[];
};

export async function loadInvoicePaymentPanel(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    proposalId: string;
    proposalTotalPence: number;
  }
): Promise<InvoicePaymentPanelData> {
  const empty: InvoicePaymentPanelData = {
    invoiceId: null,
    invoiceNumber: null,
    invoiceStatus: null,
    totalAmountPence: Math.max(0, Math.round(input.proposalTotalPence)),
    amountPaidPence: 0,
    balanceDuePence: Math.max(0, Math.round(input.proposalTotalPence)),
    legacyFullyPaidWithoutLedger: false,
    entries: [],
  };

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total_amount, amount_paid, balance_due, opening_amount_paid"
    )
    .eq("proposal_id", input.proposalId)
    .eq("workspace_id", input.workspaceId)
    .eq("status", "approved")
    .maybeSingle();

  if (!invoice) {
    return empty;
  }

  const invoiceId = String(invoice.id);
  const totalAmountPence = Math.max(
    0,
    Math.round(Number(invoice.total_amount ?? 0))
  );
  const amountPaidPence = Math.max(
    0,
    Math.round(Number(invoice.amount_paid ?? 0))
  );
  const balanceDuePence = Math.max(
    0,
    Math.round(Number(invoice.balance_due ?? 0))
  );
  const openingAmountPaid = Math.max(
    0,
    Math.round(Number(invoice.opening_amount_paid ?? 0))
  );

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select(
      "id, amount_pence, paid_on, method, reference, note, recorded_at, is_legacy_marker"
    )
    .eq("workspace_id", input.workspaceId)
    .eq("invoice_id", invoiceId)
    .eq("is_legacy_marker", false)
    .order("recorded_at", { ascending: true });

  const entries: InvoicePaymentLedgerEntry[] = (payments ?? []).map((row) => {
    const method = String(row.method ?? "other");
    return {
      id: String(row.id),
      amountPence: Math.max(0, Math.round(Number(row.amount_pence ?? 0))),
      paidOn: String(row.paid_on ?? ""),
      method,
      methodLabel: formatPaymentMethod(method),
      reference: row.reference ? String(row.reference) : null,
      note: row.note ? String(row.note) : null,
      recordedAt: String(row.recorded_at ?? ""),
    };
  });

  return {
    invoiceId,
    invoiceNumber: invoice.invoice_number
      ? String(invoice.invoice_number)
      : null,
    invoiceStatus: String(invoice.status),
    totalAmountPence,
    amountPaidPence,
    balanceDuePence,
    legacyFullyPaidWithoutLedger:
      entries.length === 0 &&
      openingAmountPaid > 0 &&
      balanceDuePence === 0,
    entries,
  };
}
