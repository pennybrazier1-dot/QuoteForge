import { hasStructuredProposal } from "@/lib/proposals/structured-proposal";
import {
  canEditProposal,
  isProposalStatus,
  type ProposalStatus,
} from "@/lib/proposals/status";

export type ProposalActionContext = {
  status: string;
  job_summary?: string | null;
  rough_notes?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  total_amount?: number | null;
};

const SENT_LIKE_STATUSES: ProposalStatus[] = [
  "ready_to_send",
  "sent",
  "accepted",
  "declined",
];

export function canPreviewProposalPdf(proposal: ProposalActionContext): boolean {
  if (proposal.status === "cancelled") {
    return false;
  }

  if (hasStructuredProposal(proposal)) {
    return true;
  }

  if (
    isProposalStatus(proposal.status) &&
    SENT_LIKE_STATUSES.includes(proposal.status)
  ) {
    return true;
  }

  const hasCustomer = Boolean(proposal.customer_name?.trim());
  const hasNotes = Boolean(proposal.rough_notes?.trim());
  const hasPrice = (proposal.total_amount ?? 0) > 0;

  return hasCustomer && hasNotes && hasPrice;
}

export function canMarkProposalReadyToSend(
  proposal: ProposalActionContext
): boolean {
  return proposal.status === "draft" && canPreviewProposalPdf(proposal);
}

export function canOpenSendProposalDialog(
  proposal: ProposalActionContext
): boolean {
  if (!canPreviewProposalPdf(proposal)) {
    return false;
  }

  if (proposal.status === "ready_to_send") {
    return Boolean(proposal.customer_email?.trim());
  }

  return false;
}

export function canUseSendAction(proposal: ProposalActionContext): boolean {
  if (!canPreviewProposalPdf(proposal)) {
    return false;
  }

  if (proposal.status === "ready_to_send") {
    return Boolean(proposal.customer_email?.trim());
  }

  return canMarkProposalReadyToSend(proposal);
}

export function getSendDisabledReason(
  proposal: ProposalActionContext
): string | null {
  if (!canPreviewProposalPdf(proposal)) {
    return "Add site notes and a price before you can send this proposal.";
  }

  if (
    proposal.status === "ready_to_send" &&
    !proposal.customer_email?.trim()
  ) {
    return "Add a customer email address to send this proposal.";
  }

  if (
    proposal.status !== "draft" &&
    proposal.status !== "ready_to_send" &&
    isProposalStatus(proposal.status)
  ) {
    return null;
  }

  return null;
}
export function canEditProposalActions(status: string): boolean {
  if (status === "cancelled") {
    return false;
  }

  return canEditProposal(status);
}
