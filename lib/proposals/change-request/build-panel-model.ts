import { analyzeChangeRequest, type ChangeRequestAnalysis } from "@/lib/proposals/change-request/analyze-change-request";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

/**
 * Server-safe helper for the Change Request panel.
 * Must stay free of "use client" so Server Components can call it.
 */
export function buildChangeRequestPanelModel(
  messages: ProposalCustomerMessage[]
): {
  message: ProposalCustomerMessage;
  analysis: ChangeRequestAnalysis;
} | null {
  const message = [...messages]
    .reverse()
    .find((item) => item.kind === "change_request");
  if (!message) {
    return null;
  }
  return {
    message,
    analysis: analyzeChangeRequest(message.body),
  };
}
