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
  /** Layout split: request first, resolve actions after the proposal. */
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
      aria-label={
        showActions && !showSummary
          ? "How to resolve this request"
          : "Customer request"
      }
      id={showSummary ? "change-request-panel" : "change-request-actions"}
    >
      {showSummary ? (
        <>
          <div className="qf-resolution-banner" role="status">
            <p className="qf-resolution-banner-title">Customer request</p>
            <p className="qf-resolution-banner-copy">
              Review what they asked for, then choose how to resolve it. Nothing
              changes until you confirm in the right tool.
            </p>
          </div>

          <div className="qf-resolution-summary">
            <div className="qf-resolution-block">
              <h3 className="qf-resolution-label">What they requested</h3>
              <p className="qf-resolution-copy">{summary.customerRequest}</p>
            </div>
            <div className="qf-resolution-block">
              <h3 className="qf-resolution-label">Original wording</h3>
              <p className="qf-resolution-copy qf-resolution-quote">
                “{summary.originalRequestWording}”
              </p>
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
        <div
          className="qf-resolution-actions"
          aria-label="How to resolve this request"
        >
          <h2 className="qf-resolution-actions-title">
            How to resolve this request
          </h2>
          <p className="qf-resolution-actions-intro">
            You choose the path. Nothing is changed until you confirm.
          </p>
          <div className="qf-resolution-action-grid">
            <div className="qf-resolution-action-option">
              <Link href={calendarHref} className="qf-btn-secondary">
                Open calendar
              </Link>
              <p className="qf-resolution-action-hint">
                For scheduling and date changes
              </p>
            </div>
            <div className="qf-resolution-action-option">
              <Link href={updateHref} className="qf-btn-secondary">
                Update proposal
              </Link>
              <p className="qf-resolution-action-hint">
                For scope, materials, price, or detail changes
              </p>
            </div>
            <div className="qf-resolution-action-option">
              <button
                type="button"
                className="qf-btn-secondary"
                onClick={() => focusProposalConversationComposer()}
              >
                Reply to customer
              </button>
              <p className="qf-resolution-action-hint">
                For clarification or questions
              </p>
            </div>
            <div className="qf-resolution-action-option">
              <form action={resolveAction}>
                <input type="hidden" name="proposalId" value={proposalId} />
                <ResolveButton />
              </form>
              <p className="qf-resolution-action-hint">
                When this request is fully handled
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
