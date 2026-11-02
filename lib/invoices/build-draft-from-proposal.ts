import { parseStringListField } from "@/lib/invoices/parse";
import type {
  InvoiceFlag,
  InvoiceLineItem,
} from "@/lib/invoices/types";
import {
  recalculateInvoiceTotals,
  validateInvoiceDraft,
} from "@/lib/invoices/validate-draft";

export { recalculateInvoiceTotals };

export type ProposalInvoiceSource = {
  id: string;
  workspace_id: string;
  customer_id?: string | null;
  title: string;
  job_summary?: string | null;
  scope_of_work?: string | null;
  materials?: unknown;
  labour_description?: string | null;
  ai_optional_extras?: unknown;
  job_address?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  subtotal_amount?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  payment_due_amount?: number | null;
};

export type BuiltInvoiceDraft = {
  line_items: InvoiceLineItem[];
  flags: InvoiceFlag[];
  work_description: string | null;
  job_title: string;
  subtotal_amount: number;
  vat_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  currency: string;
  agreed_total_amount: number;
  source_vat_amount: number;
};

function newLineId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

/**
 * Build a draft invoice snapshot from the accepted proposal / completed job.
 * Does not invent missing prices or tax rates.
 *
 * Materials and extras listed on the proposal are copied as £0
 * `included_unpriced` description lines so they are not charged twice on top
 * of the agreed labour/job total.
 */
export function buildInvoiceDraftFromProposal(
  proposal: ProposalInvoiceSource
): BuiltInvoiceDraft {
  const lineItems: InvoiceLineItem[] = [];

  const total = Math.max(0, Math.round(Number(proposal.total_amount ?? 0)));
  const vatStored = Math.max(0, Math.round(Number(proposal.vat_amount ?? 0)));
  const subtotalStored = Math.max(
    0,
    Math.round(Number(proposal.subtotal_amount ?? 0))
  );

  // Only use stored VAT when present; never invent a rate.
  const vatAmount = vatStored > 0 ? vatStored : 0;
  let subtotalAmount =
    subtotalStored > 0
      ? subtotalStored
      : Math.max(0, total - vatAmount);
  const totalAmount = total > 0 ? total : subtotalAmount + vatAmount;

  const labourText =
    proposal.labour_description?.trim() ||
    proposal.job_summary?.trim() ||
    proposal.title.trim() ||
    "Agreed job total";

  // Labour/job line carries the agreed priced total (ex-VAT when VAT is stored).
  lineItems.push({
    id: newLineId("labour", 0),
    kind: "labour",
    description: labourText,
    quantity: 1,
    unit_amount: totalAmount > 0 ? Math.max(0, totalAmount - vatAmount) : 0,
    total_amount: totalAmount > 0 ? Math.max(0, totalAmount - vatAmount) : 0,
    pricing_state: "priced",
  });

  if (subtotalAmount <= 0 && totalAmount > 0) {
    subtotalAmount = Math.max(0, totalAmount - vatAmount);
  }

  const materials = parseStringListField(proposal.materials);
  materials.forEach((description, index) => {
    lineItems.push({
      id: newLineId("materials", index),
      kind: "materials",
      description,
      quantity: 1,
      unit_amount: 0,
      total_amount: 0,
      pricing_state: "included_unpriced",
    });
  });

  const extras = parseStringListField(proposal.ai_optional_extras);
  extras.forEach((description, index) => {
    lineItems.push({
      id: newLineId("extra", index),
      kind: "extra",
      description,
      quantity: 1,
      unit_amount: 0,
      total_amount: 0,
      pricing_state: "included_unpriced",
    });
  });

  const amountPaid =
    proposal.payment_status === "paid"
      ? Math.max(
          0,
          Math.round(
            Number(
              proposal.payment_due_amount != null &&
                proposal.payment_due_amount > 0
                ? proposal.payment_due_amount
                : totalAmount
            )
          )
        )
      : 0;

  const balanceDue = Math.max(0, totalAmount - amountPaid);

  const scopeLines = parseStringListField(proposal.scope_of_work);
  const workDescription =
    proposal.job_summary?.trim() ||
    (scopeLines.length > 0 ? scopeLines.join("\n") : null);

  const validation = validateInvoiceDraft({
    line_items: lineItems,
    vat_amount: vatAmount,
    amount_paid: amountPaid,
    agreed_total_amount: totalAmount,
    source_vat_amount: vatAmount,
    adjustment_confirmed: false,
    tax_confirmed: false,
  });

  return {
    line_items: lineItems,
    flags: validation.flags,
    work_description: workDescription,
    job_title: proposal.title.trim() || "Job",
    subtotal_amount: subtotalAmount,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    balance_due: balanceDue,
    currency: (proposal.currency?.trim() || "GBP").toUpperCase().slice(0, 3),
    agreed_total_amount: totalAmount,
    source_vat_amount: vatAmount,
  };
}

