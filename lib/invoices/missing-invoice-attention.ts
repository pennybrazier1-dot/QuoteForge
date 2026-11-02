import { invoiceReviewHref } from "@/lib/invoices/attention";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export const INVOICE_NEEDS_PREPARING_REASON = "Invoice needs preparing";
export const INVOICE_PREPARE_FAILED_NOTICE =
  "Job completed, but your invoice could not be prepared. Please retry.";
export const RETRY_INVOICE_LABEL = "Retry Invoice Creation";

export type MissingInvoiceAttentionSource = {
  proposal_id: string;
  customer_name: string | null;
  title: string;
  proposal_number?: string | null;
};

export function missingInvoiceAttentionItemId(proposalId: string): string {
  return `missing-invoice:${proposalId}`;
}

/**
 * Completed jobs that still have no invoice row.
 * Callers must already scope proposals + invoice ids to the trader workspace.
 */
export function findCompletedJobsMissingInvoices<
  T extends {
    id: string;
    status: string;
    customer_name?: string | null;
    title: string;
    proposal_number?: string | null;
  },
>(
  proposals: T[],
  invoiceProposalIds: Iterable<string>
): MissingInvoiceAttentionSource[] {
  const hasInvoice = new Set(invoiceProposalIds);
  return proposals
    .filter((proposal) => {
      const status = normalizeProposalStatus(proposal.status);
      return status === "completed" && !hasInvoice.has(proposal.id);
    })
    .map((proposal) => ({
      proposal_id: proposal.id,
      customer_name: proposal.customer_name ?? null,
      title: proposal.title,
      proposal_number: proposal.proposal_number ?? null,
    }));
}

export function buildMissingInvoiceAttentionItems(
  missing: MissingInvoiceAttentionSource[]
) {
  // One item per proposal — never duplicate by invoice id.
  const seen = new Set<string>();
  const items = [];
  for (const row of missing) {
    if (seen.has(row.proposal_id)) continue;
    seen.add(row.proposal_id);
    items.push({
      id: missingInvoiceAttentionItemId(row.proposal_id),
      customer: row.customer_name?.trim() || "Customer",
      reason: INVOICE_NEEDS_PREPARING_REASON,
      typeLabel: "Retry",
      kind: "invoice_needs_preparing" as const,
      href: invoiceReviewHref(row.proposal_id),
      bucket: "needs_attention" as const,
      jobTitle: row.title,
      proposalId: row.proposal_id,
    });
  }
  return items;
}
