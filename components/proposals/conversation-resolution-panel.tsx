"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  markChangeRequestResolved,
  type ChangeRequestActionState,
} from "@/lib/proposals/change-request/actions";
import type { ConversationResolutionSummary } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import { buildCalendarActionHref } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import { focusProposalConversationComposer } from "@/components/proposals/proposal-conversation-panel";
import { buildProposalRevisePath } from "@/lib/proposals/revision/paths";

const initialState: ChangeRequestActionState = {};

function ResolveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-secondary" disabled={pending}>
      {pending ? "Saving…" : "Mark resolved"}
    </button>
  );
}

export function ConversationResolutionPanel({
  proposalId,
  summary,
}: {
  proposalId: string;
  summary: ConversationResolutionSummary;
}) {
  const [state, resolveAction] = useActionState(
    markChangeRequestResolved,
    initialState
  );

  const calendarHref = buildCalendarActionHref(proposalId, summary);
  const updateHref = buildProposalRevisePath(proposalId);

  return (
    <section
      className="qf-resolution"
      aria-label="Customer request"
      id="change-request-panel"
    >
      <div className="qf-resolution-banner" role="status">
        <p className="qf-resolution-banner-title">Customer request</p>
        <p className="qf-resolution-banner-copy">
          Read the summary, then choose the next step. Nothing is changed until
          you confirm in that tool.
        </p>
      </div>

      <div className="qf-resolution-summary">
        <div className="qf-resolution-block">
          <h3 className="qf-resolution-label">What they asked</h3>
          <p className="qf-resolution-copy">{summary.customerAsked}</p>
        </div>
        <div className="qf-resolution-block">
          <h3 className="qf-resolution-label">What was agreed</h3>
          <p className="qf-resolution-copy">{summary.whatWasAgreed}</p>
        </div>
        <div className="qf-resolution-block">
          <h3 className="qf-resolution-label">Possible impact</h3>
          <p className="qf-resolution-copy">{summary.possibleImpact}</p>
        </div>
      </div>

      {state.error ? (
        <p className="qf-resolution-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="qf-resolution-actions" aria-label="Next steps">
        <Link
          href={updateHref}
          className={
            summary.recommendedAction === "update_proposal"
              ? "qf-btn-primary"
              : "qf-btn-secondary"
          }
        >
          Update proposal
        </Link>
        <Link
          href={calendarHref}
          className={
            summary.recommendedAction === "open_calendar"
              ? "qf-btn-primary"
              : "qf-btn-secondary"
          }
        >
          Open calendar
        </Link>
        <button
          type="button"
          className={
            summary.recommendedAction === "reply"
              ? "qf-btn-primary"
              : "qf-btn-secondary"
          }
          onClick={() => focusProposalConversationComposer()}
        >
          Reply to customer
        </button>
        <form action={resolveAction}>
          <input type="hidden" name="proposalId" value={proposalId} />
          <ResolveButton />
        </form>
      </div>
    </section>
  );
}
