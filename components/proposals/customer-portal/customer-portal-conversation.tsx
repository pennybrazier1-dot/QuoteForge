"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PortalAccordion } from "@/components/proposals/customer-portal/portal-accordion";
import { PortalIconChat } from "@/components/proposals/customer-portal/portal-icons";
import {
  askPublicProposalQuestion,
  type CustomerPortalActionState,
} from "@/lib/proposals/customer-portal/actions";
import {
  CONVERSATION_HASH_ID,
  CONVERSATION_LATEST_ID,
} from "@/lib/proposals/customer-portal/conversation-deep-link";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { ProposalConversationThread } from "@/components/proposals/proposal-conversation-thread";

const initialState: CustomerPortalActionState = {};

export function CustomerPortalConversation({
  token,
  messages,
  canReply,
  businessName,
  openConversation = false,
}: {
  token: string;
  messages: ProposalCustomerMessage[];
  canReply: boolean;
  businessName: string;
  openConversation?: boolean;
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

  useEffect(() => {
    if (!openConversation) {
      return;
    }

    const focusLatest = () => {
      const latest = document.getElementById(CONVERSATION_LATEST_ID);
      const composer = document.getElementById("continue-message");
      (latest ?? document.getElementById(CONVERSATION_HASH_ID))?.scrollIntoView({
        behavior: "smooth",
        block: latest ? "end" : "start",
      });
      if (composer instanceof HTMLTextAreaElement) {
        composer.focus({ preventScroll: true });
      }
    };

    const timer = window.setTimeout(focusLatest, 50);
    return () => window.clearTimeout(timer);
  }, [openConversation, messages.length]);

  return (
    <section
      className="cj-portal-accordion-card"
      aria-label="Conversation"
      id={CONVERSATION_HASH_ID}
    >
      <PortalAccordion
        title="Conversation"
        preview={`View messages between you and ${businessName}`}
        icon={<PortalIconChat />}
        id="proposal-conversation-thread"
        defaultOpen={openConversation}
      >
        <div className="cj-conversation-wrap">
          <ProposalConversationThread
            messages={messages}
            viewer="customer"
            emptyMessage="No messages yet. Write below to start the conversation."
            variant="portal"
          />
        </div>

        {canReply ? (
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
      </PortalAccordion>
    </section>
  );
}
