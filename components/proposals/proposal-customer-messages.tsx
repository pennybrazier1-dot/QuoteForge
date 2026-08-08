import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { formatAttentionReason } from "@/lib/proposals/attention";

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function kindLabel(kind: ProposalCustomerMessage["kind"]): string {
  switch (kind) {
    case "question":
      return formatAttentionReason("customer_question");
    case "change_request":
      return formatAttentionReason("customer_requested_changes");
    case "accept_note":
      return "Customer acceptance note";
    case "trader_reply":
      return "Your reply";
    default:
      return "Customer message";
  }
}

export function ProposalCustomerMessagesPanel({
  messages,
}: {
  messages: ProposalCustomerMessage[];
}) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted">
        Customer replies from the proposal link will appear here.
      </p>
    );
  }

  return (
    <ul className="qf-customer-message-list">
      {messages.map((message) => (
        <li key={message.id} className="qf-customer-message-item">
          <div className="qf-customer-message-meta">
            <span className="qf-customer-message-kind">
              {kindLabel(message.kind)}
            </span>
            <span className="qf-customer-message-time">
              {formatMessageTime(message.created_at)}
            </span>
          </div>
          <p className="qf-customer-message-body">{message.body}</p>
        </li>
      ))}
    </ul>
  );
}
