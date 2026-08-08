"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  markChangeRequestResolved,
  type ChangeRequestActionState,
} from "@/lib/proposals/change-request/actions";
import {
  formatChangeRequestLabel,
  type ChangeRequestAnalysis,
} from "@/lib/proposals/change-request/analyze-change-request";
import { focusProposalConversationComposer } from "@/components/proposals/proposal-conversation-panel";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

const initialState: ChangeRequestActionState = {};

function ResolveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-secondary" disabled={pending}>
      {pending ? "Saving…" : "Mark resolved"}
    </button>
  );
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function ChangeRequestPanel({
  proposalId,
  message,
  analysis,
}: {
  proposalId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  message: ProposalCustomerMessage;
  analysis: ChangeRequestAnalysis;
}) {
  const [state, resolveAction] = useActionState(
    markChangeRequestResolved,
    initialState
  );

  return (
    <section
      className="qf-change-request"
      aria-label="Change request"
      id="change-request-panel"
    >
      <div className="qf-change-request-banner" role="status">
        <p className="qf-change-request-banner-title">
          Customer requested changes
        </p>
        <p className="qf-change-request-banner-copy">
          Review the request below. Suggestions are guidance only — nothing is
          changed until you decide.
        </p>
      </div>

      <div className="qf-change-request-block">
        <h3 className="qf-change-request-label">Customer message</h3>
        <p className="qf-change-request-message">{message.body}</p>
        <p className="qf-change-request-time">
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(message.created_at))}
        </p>
      </div>

      <div className="qf-change-request-block">
        <h3 className="qf-change-request-label">Request type</h3>
        <div className="qf-change-request-chips">
          {analysis.labels.map((label) => (
            <span key={label} className="qf-change-request-chip">
              {formatChangeRequestLabel(label)}
            </span>
          ))}
        </div>
      </div>

      <div className="qf-change-request-block">
        <h3 className="qf-change-request-label">Summary</h3>
        <p className="qf-change-request-copy">{analysis.summary}</p>
      </div>

      <div className="qf-change-request-block">
        <h3 className="qf-change-request-label">Suggested next action</h3>
        <p className="qf-change-request-action-title">
          {analysis.suggestedAction.label}
        </p>
        <p className="qf-change-request-copy">
          {analysis.suggestedAction.detail}
        </p>
      </div>

      {state.error ? (
        <p className="qf-change-request-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="qf-change-request-actions">
        <button
          type="button"
          className="qf-btn-primary"
          onClick={() => focusProposalConversationComposer()}
        >
          Reply to customer
        </button>
        <button
          type="button"
          className="qf-btn-secondary"
          onClick={() => scrollToId("change-request-review-target")}
        >
          Review request
        </button>
        <form action={resolveAction}>
          <input type="hidden" name="proposalId" value={proposalId} />
          <ResolveButton />
        </form>
      </div>
    </section>
  );
}
