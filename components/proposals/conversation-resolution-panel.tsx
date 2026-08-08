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
  section = "all",
}: {
  proposalId: string;
  summary: ConversationResolutionSummary;
  /** Layout split: summary first, actions after the proposal. */
  section?: "summary" | "actions" | "all";
}) {
  const [state, resolveAction] = useActionState(
    markChangeRequestResolved,
    initialState
  );

  const calendarHref = buildCalendarActionHref(proposalId, summary);
  const updateHref = buildProposalRevisePath(proposalId);
  const showSummary = section === "summary" || section === "all";
  const showActions = section === "actions" || section === "all";

  return (
    <section
      className="qf-resolution"
      aria-label={showActions && !showSummary ? "Next steps" : "Customer request"}
      id={showSummary ? "change-request-panel" : "change-request-actions"}
    >
      {showSummary ? (
        <>
          <div className="qf-resolution-banner" role="status">
            <p className="qf-resolution-banner-title">Customer request</p>
            <p className="qf-resolution-banner-copy">
              Review the request and current proposal first, then choose the
              next step.
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
        </>
      ) : null}

      {state.error && showActions ? (
        <p className="qf-resolution-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {showActions ? (
        <div className="qf-resolution-actions" aria-label="Next steps">
          {!showSummary ? (
            <p className="qf-resolution-actions-intro">
              Choose how to resolve this request. Nothing is changed until you
              confirm in that tool.
            </p>
          ) : null}
          <div className="qf-resolution-actions-row">
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
        </div>
      ) : null}
    </section>
  );
}
