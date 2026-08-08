"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ProposalConversationThread } from "@/components/proposals/proposal-conversation-thread";
import {
  createTraderProposalReply,
  type TraderReplyActionState,
} from "@/lib/proposals/customer-portal/trader-reply-actions";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { buildProposalRevisePath } from "@/lib/proposals/revision/paths";

const initialState: TraderReplyActionState = {};

function SendReplyButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Sending…" : "Send reply"}
    </button>
  );
}

export function ProposalConversationPanel({
  proposalId,
  messages,
  canReply = true,
  showThread = true,
  showComposer = true,
  showReviseLink = true,
}: {
  proposalId: string;
  messages: ProposalCustomerMessage[];
  canReply?: boolean;
  showThread?: boolean;
  showComposer?: boolean;
  showReviseLink?: boolean;
}) {
  const [state, action] = useActionState(
    createTraderProposalReply,
    initialState
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  useEffect(() => {
    const focusComposer = () => {
      textareaRef.current?.focus();
    };
    window.addEventListener("proposal-conversation-focus", focusComposer);
    return () => {
      window.removeEventListener("proposal-conversation-focus", focusComposer);
    };
  }, []);

  return (
    <section
      className="qf-conversation"
      aria-label="Proposal conversation"
      id={showComposer ? "proposal-conversation" : undefined}
    >
      {showThread ? (
        <ProposalConversationThread
          messages={messages}
          viewer="trader"
          emptyMessage="Messages with your customer will appear here."
          variant="workspace"
        />
      ) : null}

      {showReviseLink && messages.length > 0 ? (
        <div className="qf-conversation-revise">
          <Link
            href={buildProposalRevisePath(proposalId)}
            className="qf-btn-secondary"
          >
            Update proposal
          </Link>
          <p className="qf-conversation-revise-hint">
            Write changes in your own words. Nothing is applied automatically.
          </p>
        </div>
      ) : null}

      {showComposer && canReply ? (
        <form
          ref={formRef}
          action={action}
          className="qf-conversation-compose"
          id="proposal-conversation-compose"
        >
          <input type="hidden" name="proposalId" value={proposalId} />
          <label className="qf-conversation-compose-label" htmlFor="trader-reply">
            Your reply
          </label>
          <textarea
            ref={textareaRef}
            id="trader-reply"
            name="body"
            required
            rows={4}
            maxLength={4000}
            className="qf-conversation-textarea"
            placeholder="Write your reply to the customer…"
          />
          {state.error ? (
            <p className="qf-conversation-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="qf-conversation-success" role="status">
              Reply sent. Your customer will get a notification email with a link
              back to the conversation.
            </p>
          ) : null}
          <div className="qf-conversation-compose-actions">
            <SendReplyButton />
          </div>
        </form>
      ) : null}

      {showComposer && !canReply ? (
        <p className="text-sm text-muted mt-4">
          This proposal isn’t open for new replies right now.
        </p>
      ) : null}
    </section>
  );
}

export function focusProposalConversationComposer() {
  if (typeof window === "undefined") {
    return;
  }
  const compose =
    document.getElementById("proposal-conversation-compose") ??
    document.getElementById("proposal-conversation");
  compose?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.dispatchEvent(new Event("proposal-conversation-focus"));
}
