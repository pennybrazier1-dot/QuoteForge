"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  askPublicProposalQuestion,
  type CustomerPortalActionState,
} from "@/lib/proposals/customer-portal/actions";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { ProposalConversationThread } from "@/components/proposals/proposal-conversation-thread";

const initialState: CustomerPortalActionState = {};

export function CustomerPortalConversation({
  token,
  messages,
  canRespond,
  businessName,
}: {
  token: string;
  messages: ProposalCustomerMessage[];
  canRespond: boolean;
  businessName: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    askPublicProposalQuestion,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <section
      className="cj-job-card"
      aria-label="Conversation"
      id="proposal-conversation"
    >
      <h2 className="cj-job-section-title">Conversation</h2>
      <p className="cj-job-copy">
        Messages with {businessName} stay on this secure proposal link.
      </p>

      <div className="cj-conversation-wrap">
        <ProposalConversationThread
          messages={messages}
          viewer="customer"
          emptyMessage="No messages yet. Write below to start the conversation."
          variant="portal"
        />
      </div>

      {canRespond ? (
        <form ref={formRef} action={action} className="cj-portal-form">
          <input type="hidden" name="token" value={token} />
          <label className="cj-portal-label" htmlFor="continue-message">
            Continue the conversation
          </label>
          <textarea
            id="continue-message"
            name="message"
            required
            rows={4}
            maxLength={4000}
            className="cj-portal-textarea"
            placeholder="Write a message…"
          />
          {state.error ? (
            <p className="cj-portal-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="cj-job-copy" role="status">
              Message sent. {businessName} has been notified.
            </p>
          ) : null}
          <div className="cj-portal-form-actions">
            <button
              type="submit"
              className="cj-btn-primary"
              disabled={pending}
            >
              {pending ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      ) : (
        <p className="cj-job-copy">
          This conversation is view-only for now. Contact {businessName} if you
          need more help.
        </p>
      )}
    </section>
  );
}
