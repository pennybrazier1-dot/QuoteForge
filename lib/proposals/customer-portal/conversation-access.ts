import { isOrdinaryConversation } from "@/lib/proposals/change-request/classify-conversation-intent";
import { isClosedProposalStatus, normalizeProposalStatus } from "@/lib/proposals/status";

/**
 * Customer/trader messaging stays open for the whole active job.
 * Read-only only when the proposal is genuinely closed.
 *
 * Closed today: cancelled, declined.
 * There is no separate archived/closed-job communication state yet,
 * so booked, in-progress, completed, invoiced, and paid stay replyable.
 */
export function isConversationReplyable(status: string): boolean {
  return !isClosedProposalStatus(status);
}

export function shouldFlagAttentionForCustomerMessage(
  status: string,
  message?: string
): boolean {
  const normalized = normalizeProposalStatus(status);
  if (
    normalized !== "waiting_for_customer" &&
    normalized !== "needs_attention"
  ) {
    return false;
  }
  if (message != null && isOrdinaryConversation(message)) {
    return false;
  }
  return true;
}
