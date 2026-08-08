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
  /** Prefer "all" so request and resolve actions stay grouped. */
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
      aria-label="Customer request and how to resolve it"
      id="change-request-panel"
    >
      {/* Desktop: full request context + all resolve paths (unchanged). */}
      <div className="qf-resolution-desktop">
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
                <h3 className="qf-resolution-label">Customer requests</h3>
                {summary.customerRequestItems.length > 0 ? (
                  <ul className="qf-resolution-request-list">
                    {summary.customerRequestItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="qf-resolution-copy">{summary.customerRequest}</p>
                )}
              </div>
              <div className="qf-resolution-block">
                <h3 className="qf-resolution-label">Original wording</h3>
                <div className="qf-resolution-copy qf-resolution-quote qf-resolution-wording">
                  {summary.originalRequestWording.split("\n").map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
              {summary.possibleImpacts.length > 0 ? (
                <div className="qf-resolution-block">
                  <h3 className="qf-resolution-label">Possible impact</h3>
                  <ul className="qf-resolution-request-list">
                    {summary.possibleImpacts.map((impact) => (
                      <li key={impact}>{impact}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
      </div>

      {/* Mobile: situation + next action only. */}
      <div className="qf-resolution-mobile">
        {showSummary ? (
          <div className="qf-resolution-mobile-card" role="status">
            <p className="qf-resolution-mobile-headline">
              {summary.mobileHeadline}
            </p>
            <p className="qf-resolution-mobile-description">
              {summary.mobileDescription}
            </p>
          </div>
        ) : null}

        {state.error && showActions ? (
          <p className="qf-resolution-error" role="alert">
            {state.error}
          </p>
        ) : null}

        {showActions ? (
          <div
            className="qf-resolution-mobile-next"
            aria-label="What to do next"
          >
            {summary.resolutionFocus === "date" ? (
              <>
                <h2 className="qf-resolution-mobile-next-title">
                  Can you accommodate this?
                </h2>
                <div className="qf-resolution-mobile-actions">
                  <Link href={calendarHref} className="qf-btn-primary">
                    Yes
                  </Link>
                  <button
                    type="button"
                    className="qf-btn-secondary"
                    onClick={() => focusProposalConversationComposer()}
                  >
                    No
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="qf-resolution-mobile-next-title">
                  Update proposal
                </h2>
                <div className="qf-resolution-mobile-actions">
                  <Link href={updateHref} className="qf-btn-primary">
                    Update proposal
                  </Link>
                  <button
                    type="button"
                    className="qf-btn-secondary"
                    onClick={() => focusProposalConversationComposer()}
                  >
                    Reply to customer
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
