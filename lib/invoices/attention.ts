import type { InvoiceDraftAttentionSource } from "@/lib/invoices/types";
import { formatPenceAsGbp } from "@/lib/proposals/money";

export const INVOICE_READY_ATTENTION_REASON = "Invoice ready for review";

export function invoiceAttentionItemId(invoiceId: string): string {
  return `invoice:${invoiceId}`;
}

export function invoiceReviewHref(proposalId: string): string {
  return `/proposals/${proposalId}/invoice`;
}

export function buildInvoiceDraftAttentionItems(
  drafts: InvoiceDraftAttentionSource[]
) {
  return drafts
    .filter((draft) => draft.status === "draft")
    .map((draft) => {
      const amount = formatPenceAsGbp(
        draft.balance_due > 0 ? draft.balance_due : draft.total_amount
      );
      return {
        id: invoiceAttentionItemId(draft.id),
        customer: draft.customer_name?.trim() || "Customer",
        reason: INVOICE_READY_ATTENTION_REASON,
        typeLabel: amount,
        kind: "invoice_ready_for_review" as const,
        href: invoiceReviewHref(draft.proposal_id),
        bucket: "needs_attention" as const,
        jobTitle: draft.job_title,
        invoiceNumber: draft.invoice_number,
        proposalId: draft.proposal_id,
        totalAmount: draft.total_amount,
        balanceDue: draft.balance_due,
      };
    });
}
