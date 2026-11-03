import {
  classifyHomeProposal,
  type HomeProposalBucket,
} from "@/lib/home/home-lifecycle";
import type { HomeProposal } from "@/lib/home/home-data";
import { buildInvoiceDraftAttentionItems } from "@/lib/invoices/attention";
import { buildMissingInvoiceAttentionItems } from "@/lib/invoices/missing-invoice-attention";
import type { MissingInvoiceAttentionSource } from "@/lib/invoices/missing-invoice-attention";
import type { InvoiceDraftAttentionSource } from "@/lib/invoices/types";
import { isActiveHomeProposal, normalizeProposalStatus } from "@/lib/proposals/status";

export const HOME_ATTENTION_TITLE = "Needs your attention";
export const HOME_ATTENTION_EMPTY = "You're all caught up.";

export const HOME_ATTENTION_BUCKETS = [
  "needs_attention",
  "quotes_to_finish",
  "quotes_ready_to_send",
  "jobs_to_schedule",
] as const;

export type HomeAttentionBucket = (typeof HOME_ATTENTION_BUCKETS)[number];

export type HomeAttentionKind =
  | "customer_question"
  | "customer_change"
  | "customer_date_change"
  | "quote_to_finish"
  | "quote_ready_to_send"
  | "job_to_schedule"
  | "failed_send"
  | "needs_response"
  | "invoice_ready_for_review"
  | "invoice_needs_preparing";

export type HomeAttentionItem = {
  id: string;
  customer: string;
  reason: string;
  typeLabel: string;
  kind: HomeAttentionKind;
  href: string;
  bucket: HomeAttentionBucket;
};

export type HomeAttentionSource = HomeProposal & {
  last_send_error?: string | null;
};

export function isHomeAttentionBucket(
  bucket: HomeProposalBucket
): bucket is HomeAttentionBucket {
  return (HOME_ATTENTION_BUCKETS as readonly string[]).includes(bucket);
}

export function attentionItemHref(
  bucket: HomeAttentionBucket,
  proposalId: string
): string {
  if (bucket === "quotes_to_finish") {
    return `/proposals/${proposalId}/edit`;
  }
  if (bucket === "jobs_to_schedule") {
    return `/proposals/${proposalId}/schedule`;
  }
  return `/proposals/${proposalId}`;
}

function attentionCopy(
  proposal: HomeAttentionSource,
  bucket: HomeAttentionBucket
): { reason: string; typeLabel: string; kind: HomeAttentionKind } {
  if (proposal.last_send_error?.trim() && bucket === "quotes_ready_to_send") {
    return {
      reason: "Email failed — tap to retry",
      typeLabel: "Send failed",
      kind: "failed_send",
    };
  }

  if (bucket === "quotes_to_finish") {
    return {
      reason: "Quote to finish",
      typeLabel: "Quote",
      kind: "quote_to_finish",
    };
  }

  if (bucket === "quotes_ready_to_send") {
    return {
      reason: "Quote ready to send",
      typeLabel: "Ready",
      kind: "quote_ready_to_send",
    };
  }

  if (bucket === "jobs_to_schedule") {
    return {
      reason: "Job needs scheduling",
      typeLabel: "Schedule",
      kind: "job_to_schedule",
    };
  }

  switch (proposal.attention_reason) {
    case "customer_question":
      return {
        reason: "Customer question",
        typeLabel: "Question",
        kind: "customer_question",
      };
    case "customer_requested_changes":
      return {
        reason: "Customer requested a change",
        typeLabel: "Change",
        kind: "customer_change",
      };
    case "customer_requested_date_change":
      return {
        reason: "Customer requested a date change",
        typeLabel: "Date change",
        kind: "customer_date_change",
      };
    case "revision_ready_to_send":
      return {
        reason: "Revised proposal ready to send",
        typeLabel: "Revision",
        kind: "needs_response",
      };
    default:
      return {
        reason: "Needs your response",
        typeLabel: "Respond",
        kind: "needs_response",
      };
  }
}

export function buildHomeAttentionItems(
  proposals: HomeAttentionSource[],
  reference = new Date(),
  invoiceDrafts: InvoiceDraftAttentionSource[] = [],
  missingInvoices: MissingInvoiceAttentionSource[] = []
): HomeAttentionItem[] {
  const proposalItems = proposals
    .filter((proposal) =>
      isActiveHomeProposal(normalizeProposalStatus(proposal.status))
    )
    .map((proposal) => {
      const classified = classifyHomeProposal(proposal, reference);
      if (!isHomeAttentionBucket(classified.bucket)) {
        return null;
      }

      const copy = attentionCopy(proposal, classified.bucket);
      return {
        id: proposal.id,
        customer: proposal.customer_name?.trim() || "Customer",
        reason: copy.reason,
        typeLabel: copy.typeLabel,
        kind: copy.kind,
        href: attentionItemHref(classified.bucket, proposal.id),
        bucket: classified.bucket,
      };
    })
    .filter((item): item is HomeAttentionItem => Boolean(item));

  const invoiceItems = buildInvoiceDraftAttentionItems(invoiceDrafts).map(
    (item) =>
      ({
        id: item.id,
        customer: item.customer,
        reason: item.reason,
        typeLabel: item.typeLabel,
        kind: item.kind,
        href: item.href,
        bucket: item.bucket,
      }) satisfies HomeAttentionItem
  );

  const missingItems = buildMissingInvoiceAttentionItems(missingInvoices).map(
    (item) =>
      ({
        id: item.id,
        customer: item.customer,
        reason: item.reason,
        typeLabel: item.typeLabel,
        kind: item.kind,
        href: item.href,
        bucket: item.bucket,
      }) satisfies HomeAttentionItem
  );

  // Missing invoice recovery first, then drafts, then other attention.
  return [...missingItems, ...invoiceItems, ...proposalItems];
}

export function getHomeAttentionCount(
  proposals: HomeAttentionSource[],
  reference = new Date(),
  invoiceDrafts: InvoiceDraftAttentionSource[] = [],
  missingInvoices: MissingInvoiceAttentionSource[] = []
): number {
  return buildHomeAttentionItems(
    proposals,
    reference,
    invoiceDrafts,
    missingInvoices
  ).length;
}
