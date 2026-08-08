import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

/** Oldest first for chat-style display. */
export function sortConversationMessages(
  messages: ProposalCustomerMessage[]
): ProposalCustomerMessage[] {
  return [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function conversationAuthorLabel(
  message: ProposalCustomerMessage,
  viewer: "trader" | "customer"
): string {
  if (message.direction === "trader" || message.kind === "trader_reply") {
    return viewer === "trader" ? "You" : "Trader";
  }

  switch (message.kind) {
    case "change_request":
      return viewer === "customer" ? "You (change request)" : "Customer (change request)";
    case "question":
      return viewer === "customer" ? "You (question)" : "Customer (question)";
    case "accept_note":
      return viewer === "customer" ? "You (note)" : "Customer (note)";
    default:
      return viewer === "customer" ? "You" : "Customer";
  }
}
