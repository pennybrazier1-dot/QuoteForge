import { isOrdinaryConversation } from "@/lib/proposals/change-request/classify-conversation-intent";
import {
  isClosedProposalStatus,
  isFullyClosedJobStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";

/**
 * Customer/trader messaging stays open for the whole active job.
 * Read-only only when the proposal is genuinely closed.
 *
 * Messaging stays open through completed and paid.
 * It becomes read-only after the job is fully closed, or if cancelled/declined.
 */
export function isConversationReplyable(status: string): boolean {
  return !isClosedProposalStatus(status) && !isFullyClosedJobStatus(status);
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
