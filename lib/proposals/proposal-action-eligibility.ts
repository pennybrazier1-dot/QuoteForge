import { hasStructuredProposal } from "@/lib/proposals/structured-proposal";
import {
  canEditProposal,
  isProposalStatus,
  normalizeProposalStatus,
  type ProposalStatus,
} from "@/lib/proposals/status";

export type ProposalActionContext = {
  status: string;
  job_summary?: string | null;
  rough_notes?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  linked_customer_email?: string | null;
  total_amount?: number | null;
};

const QUOTE_READY_STATUSES: ProposalStatus[] = [
  "ready_to_send",
  "waiting_for_customer",
  "needs_attention",
  "booked",
  "declined",
];

export function canPreviewProposalPdf(proposal: ProposalActionContext): boolean {
  const status = normalizeProposalStatus(proposal.status);

  if (status === "cancelled") {
    return false;
  }

  if (hasStructuredProposal(proposal)) {
    return true;
  }

  if (isProposalStatus(status) && QUOTE_READY_STATUSES.includes(status)) {
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
  return (
    normalizeProposalStatus(proposal.status) === "draft" &&
    canPreviewProposalPdf(proposal)
  );
}

export function canOpenSendProposalDialog(
  proposal: ProposalActionContext
): boolean {
  if (!canPreviewProposalPdf(proposal)) {
    return false;
  }

  if (normalizeProposalStatus(proposal.status) === "ready_to_send") {
    return Boolean(proposal.customer_email?.trim());
  }

  return false;
}

export function canUseSendAction(proposal: ProposalActionContext): boolean {
  if (!canPreviewProposalPdf(proposal)) {
    return false;
  }

  if (normalizeProposalStatus(proposal.status) === "ready_to_send") {
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
    normalizeProposalStatus(proposal.status) === "ready_to_send" &&
    !proposal.customer_email?.trim()
  ) {
    return "Add a customer email address to send this proposal.";
  }

  const status = normalizeProposalStatus(proposal.status);

  if (
    status !== "draft" &&
    status !== "ready_to_send" &&
    isProposalStatus(status)
  ) {
    return null;
  }

  return null;
}

export function resolveResendCustomerEmail(
  ...emails: Array<string | null | undefined>
): string | null {
  for (const email of emails) {
    const trimmed = email?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

export function isClosedForResend(status: string): boolean {
  const normalized = normalizeProposalStatus(status);
  return (
    normalized === "booked" ||
    normalized === "completed" ||
    normalized === "closed" ||
    normalized === "declined" ||
    normalized === "cancelled"
  );
}

/** Show Resend while the proposal is waiting — date state does not matter. */
export function canShowResendWaitingProposal(status: string): boolean {
  return normalizeProposalStatus(status) === "waiting_for_customer";
}

export type ResendWaitingEnablement = {
  shown: boolean;
  enabled: boolean;
  reason: "no_email" | "closed" | "sending" | "not_waiting" | null;
};

/**
 * Enable Resend only for waiting_for_customer with an email,
 * or while a send is in progress. Date / hold / accepted_at must not block it.
 */
export function getResendWaitingEnablement(input: {
  status: string;
  customerEmail?: string | null;
  linkedCustomerEmail?: string | null;
  sending?: boolean;
  bookingConfirmation?: string | null;
  acceptedAt?: string | null;
  sentAt?: string | null;
}): ResendWaitingEnablement {
  void input.bookingConfirmation;
  void input.acceptedAt;
  void input.sentAt;

  if (isClosedForResend(input.status)) {
    return { shown: false, enabled: false, reason: "closed" };
  }

  if (!canShowResendWaitingProposal(input.status)) {
    return { shown: false, enabled: false, reason: "not_waiting" };
  }

  const email = resolveResendCustomerEmail(
    input.customerEmail,
    input.linkedCustomerEmail
  );
  if (!email) {
    return { shown: true, enabled: false, reason: "no_email" };
  }
  if (input.sending) {
    return { shown: true, enabled: false, reason: "sending" };
  }
  return { shown: true, enabled: true, reason: null };
}

export function canEditProposalActions(status: string): boolean {
  const normalized = normalizeProposalStatus(status);

  if (normalized === "cancelled" || normalized === "completed") {
    return false;
  }

  return canEditProposal(normalized);
}
