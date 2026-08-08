import {
  conversationAuthorLabel,
  sortConversationMessages,
} from "@/lib/proposals/customer-portal/conversation";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ProposalConversationThread({
  messages,
  viewer,
  emptyMessage,
  variant = "workspace",
}: {
  messages: ProposalCustomerMessage[];
  viewer: "trader" | "customer";
  emptyMessage: string;
  variant?: "workspace" | "portal";
}) {
  const ordered = sortConversationMessages(messages);
  const root =
    variant === "portal" ? "cj-conversation-thread" : "qf-conversation-thread";
  const itemClass =
    variant === "portal" ? "cj-conversation-item" : "qf-conversation-item";
  const traderClass =
    variant === "portal"
      ? "cj-conversation-item-trader"
      : "qf-conversation-item-trader";
  const customerClass =
    variant === "portal"
      ? "cj-conversation-item-customer"
      : "qf-conversation-item-customer";

  if (ordered.length === 0) {
    return (
      <p
        className={
          variant === "portal" ? "cj-job-copy" : "text-sm text-muted"
        }
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className={root}>
      {ordered.map((message) => {
        const fromTrader =
          message.direction === "trader" || message.kind === "trader_reply";
        return (
          <li
            key={message.id}
            className={`${itemClass} ${fromTrader ? traderClass : customerClass}`}
          >
            <div
              className={
                variant === "portal"
                  ? "cj-conversation-meta"
                  : "qf-conversation-meta"
              }
            >
              <span
                className={
                  variant === "portal"
                    ? "cj-conversation-author"
                    : "qf-conversation-author"
                }
              >
                {conversationAuthorLabel(message, viewer)}
              </span>
              <span
                className={
                  variant === "portal"
                    ? "cj-conversation-time"
                    : "qf-conversation-time"
                }
              >
                {formatMessageTime(message.created_at)}
              </span>
            </div>
            <p
              className={
                variant === "portal"
                  ? "cj-conversation-body"
                  : "qf-conversation-body"
              }
            >
              {message.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
