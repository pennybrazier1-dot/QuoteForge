"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { markChangeRequestResolved } from "@/lib/proposals/change-request/actions";
import {
  buildCalendarActionHref,
  type ConversationResolutionSummary,
} from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import {
  beginResolutionDismiss,
  completeResolutionDismiss,
  dispatchResolutionDismissed,
  dispatchResolutionRestored,
  emptyOptimisticResolutionState,
  failResolutionDismiss,
} from "@/lib/proposals/change-request/optimistic-resolution";
import {
  acceptCustomerRequestedDate,
  confirmConversationDate,
  holdConversationDate,
  type DateWorkflowActionState,
} from "@/lib/proposals/date-workflow-actions";
import { focusProposalConversationComposer } from "@/components/proposals/proposal-conversation-panel";
import { buildProposalRevisePath } from "@/lib/proposals/revision/paths";

const dateInitialState: DateWorkflowActionState = {};

function DateActionButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={variant === "primary" ? "qf-btn-primary" : "qf-btn-secondary"}
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function DateSlotFields({
  proposalId,
  summary,
}: {
  proposalId: string;
  summary: ConversationResolutionSummary;
}) {
  return (
    <>
      <input type="hidden" name="proposalId" value={proposalId} />
      <input
        type="hidden"
        name="plannedStartDateExact"
        value={summary.plannedStartExact ?? ""}
      />
      <input
        type="hidden"
        name="plannedStartTime"
        value={summary.plannedStartTime ?? ""}
      />
      <input
        type="hidden"
        name="plannedStartDateText"
        value={summary.plannedStartText ?? ""}
      />
    </>
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
  const [opt, setOpt] = useState(emptyOptimisticResolutionState);
  const optRef = useRef(opt);
  const [confirmState, confirmAction] = useActionState(
    confirmConversationDate,
    dateInitialState
  );
  const [holdState, holdAction] = useActionState(
    holdConversationDate,
    dateInitialState
  );
  const [acceptRequestedState, acceptRequestedAction] = useActionState(
    acceptCustomerRequestedDate,
    dateInitialState
  );

  const updateHref = buildProposalRevisePath(proposalId);
  const calendarHref = buildCalendarActionHref(proposalId, summary);
  const showSummary = section === "summary" || section === "all";
  const showActions = section === "actions" || section === "all";
  const dateCard =
    summary.resolutionFocus === "date_agreed" ||
    summary.resolutionFocus === "date_discussed";
  const dateError =
    confirmState.error || holdState.error || acceptRequestedState.error;
  const showUpdateProposal = summary.showUpdateProposal;

  function persistResolved() {
    if (optRef.current.pending || optRef.current.dismissed) {
      return;
    }
    const next = beginResolutionDismiss(optRef.current);
    optRef.current = next;
    setOpt(next);
    dispatchResolutionDismissed();

    const formData = new FormData();
    formData.set("proposalId", proposalId);
    void markChangeRequestResolved({}, formData).then((result) => {
      if (result.ok) {
        const saved = completeResolutionDismiss(optRef.current);
        optRef.current = saved;
        setOpt(saved);
        return;
      }
      const failed = failResolutionDismiss(
        optRef.current,
        result.error ?? "Could not mark this request resolved."
      );
      optRef.current = failed;
      setOpt(failed);
      dispatchResolutionRestored();
    });
  }

  if (opt.dismissed) {
    return null;
  }

  return (
    <section
      className="qf-resolution"
      aria-label="Customer request and how to resolve it"
      id="change-request-panel"
    >
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
              {dateCard && summary.agreedSlotLabel ? (
                <div className="qf-resolution-block">
                  <h3 className="qf-resolution-label">
                    {summary.resolutionFocus === "date_agreed"
                      ? "Date agreed"
                      : "Date discussed"}
                  </h3>
                  <p className="qf-resolution-copy">{summary.agreedSlotLabel}</p>
                </div>
              ) : null}
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

        {(opt.error || dateError) && showActions ? (
          <p className="qf-resolution-error" role="alert">
            {opt.error || dateError}
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
              {summary.showAcceptRequestedDate ? (
                <div className="qf-resolution-action-option">
                  <form action={acceptRequestedAction}>
                    <input type="hidden" name="proposalId" value={proposalId} />
                    <input
                      type="hidden"
                      name="plannedStartDateExact"
                      value={summary.requestedStartExact ?? ""}
                    />
                    <input
                      type="hidden"
                      name="plannedStartTime"
                      value={summary.requestedStartTime ?? ""}
                    />
                    <input
                      type="hidden"
                      name="plannedStartDateText"
                      value={summary.requestedSlotLabel ?? ""}
                    />
                    <DateActionButton
                      label="Accept requested date"
                      pendingLabel="Booking…"
                    />
                  </form>
                  <p className="qf-resolution-action-hint">
                    {summary.requestedSlotLabel
                      ? `Books ${summary.requestedSlotLabel} because the customer asked for it.`
                      : "Agree to the customer's requested date and book the job."}
                  </p>
                </div>
              ) : null}
              {summary.showAcceptRequestedDate || summary.resolutionFocus === "date" ? (
                <div className="qf-resolution-action-option">
                  <form action={holdAction}>
                    <input type="hidden" name="proposalId" value={proposalId} />
                    <label className="qf-resolution-action-hint" htmlFor="suggest-date">
                      Suggest another date/time
                    </label>
                    <input
                      id="suggest-date"
                      type="date"
                      name="plannedStartDateExact"
                      className="qf-field"
                      required
                    />
                    <input
                      type="time"
                      name="plannedStartTime"
                      className="qf-field"
                      required
                    />
                    <DateActionButton
                      label="Suggest another date/time"
                      pendingLabel="Sending…"
                      variant="secondary"
                    />
                  </form>
                </div>
              ) : null}
              {summary.showDateActions ? (
                <>
                  <div className="qf-resolution-action-option">
                    {summary.canActOnSlot ? (
                      <form action={confirmAction}>
                        <DateSlotFields
                          proposalId={proposalId}
                          summary={summary}
                        />
                        <DateActionButton
                          label="Confirm date"
                          pendingLabel="Saving…"
                        />
                      </form>
                    ) : (
                      <a href={calendarHref} className="qf-btn-primary">
                        Confirm date
                      </a>
                    )}
                    <p className="qf-resolution-action-hint">
                      Use this when the customer has already agreed the date.
                    </p>
                  </div>
                  <div className="qf-resolution-action-option">
                    {summary.canActOnSlot ? (
                      <form action={holdAction}>
                        <DateSlotFields
                          proposalId={proposalId}
                          summary={summary}
                        />
                        <DateActionButton
                          label="Hold provisionally"
                          pendingLabel="Saving…"
                          variant="secondary"
                        />
                      </form>
                    ) : (
                      <a href={calendarHref} className="qf-btn-secondary">
                        Hold provisionally
                      </a>
                    )}
                    <p className="qf-resolution-action-hint">
                      Reserve the slot while the customer still needs to confirm.
                    </p>
                  </div>
                </>
              ) : null}
              {showUpdateProposal ? (
                <div className="qf-resolution-action-option">
                  <a href={updateHref} className="qf-btn-secondary">
                    Update proposal
                  </a>
                  <p className="qf-resolution-action-hint">
                    For scope, materials, price, or detail changes
                  </p>
                </div>
              ) : null}
              <div className="qf-resolution-action-option">
                <button
                  type="button"
                  className="qf-btn-secondary"
                  onClick={() => focusProposalConversationComposer()}
                >
                  Change / Reply
                </button>
                <p className="qf-resolution-action-hint">
                  Continue the timing discussion
                </p>
              </div>
              <div className="qf-resolution-action-option">
                <button
                  type="button"
                  className="qf-btn-secondary"
                  onClick={persistResolved}
                >
                  Mark resolved
                </button>
                <p className="qf-resolution-action-hint">
                  When this request is fully handled
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="qf-resolution-mobile">
        {showSummary ? (
          <div
            className={`qf-resolution-mobile-card${
              summary.resolutionFocus === "date_agreed"
                ? " qf-resolution-mobile-card-agreed"
                : ""
            }`}
            role="status"
          >
            <p className="qf-resolution-mobile-headline">
              {summary.mobileHeadline}
            </p>
            <p className="qf-resolution-mobile-description">
              {summary.mobileDescription}
            </p>
          </div>
        ) : null}

        {(opt.error || dateError) && showActions ? (
          <p className="qf-resolution-error" role="alert">
            {opt.error || dateError}
          </p>
        ) : null}

        {showActions ? (
          <div
            className="qf-resolution-mobile-next"
            aria-label="What to do next"
          >
            {summary.showDateActions ? (
              <div className="qf-resolution-mobile-actions qf-resolution-mobile-date-actions">
                {summary.canActOnSlot ? (
                  <form action={confirmAction}>
                    <DateSlotFields proposalId={proposalId} summary={summary} />
                    <DateActionButton
                      label="Confirm date"
                      pendingLabel="Saving…"
                    />
                  </form>
                ) : (
                  <a href={calendarHref} className="qf-btn-primary">
                    Confirm date
                  </a>
                )}
                {summary.canActOnSlot ? (
                  <form action={holdAction}>
                    <DateSlotFields proposalId={proposalId} summary={summary} />
                    <DateActionButton
                      label="Hold provisionally"
                      pendingLabel="Saving…"
                      variant="secondary"
                    />
                  </form>
                ) : (
                  <a href={calendarHref} className="qf-btn-secondary">
                    Hold provisionally
                  </a>
                )}
                <button
                  type="button"
                  className="qf-btn-secondary"
                  onClick={() => focusProposalConversationComposer()}
                >
                  Change / Reply
                </button>
              </div>
            ) : summary.resolutionFocus === "date" ||
              summary.showAcceptRequestedDate ? (
              <>
                <h2 className="qf-resolution-mobile-next-title">
                  Customer requested a different date/time
                </h2>
                <p className="qf-resolution-mobile-description">
                  {summary.requestedSlotLabel || summary.mobileDescription}
                </p>
                <div className="qf-resolution-mobile-actions">
                  {summary.showAcceptRequestedDate ? (
                    <form action={acceptRequestedAction}>
                      <input type="hidden" name="proposalId" value={proposalId} />
                      <input
                        type="hidden"
                        name="plannedStartDateExact"
                        value={summary.requestedStartExact ?? ""}
                      />
                      <input
                        type="hidden"
                        name="plannedStartTime"
                        value={summary.requestedStartTime ?? ""}
                      />
                      <DateActionButton
                        label="Accept requested date"
                        pendingLabel="Booking…"
                      />
                    </form>
                  ) : null}
                  <form action={holdAction}>
                    <input type="hidden" name="proposalId" value={proposalId} />
                    <input type="date" name="plannedStartDateExact" required />
                    <input type="time" name="plannedStartTime" required />
                    <DateActionButton
                      label="Suggest another date/time"
                      pendingLabel="Sending…"
                      variant="secondary"
                    />
                  </form>
                </div>
              </>
            ) : (
              <>
                {showUpdateProposal ? (
                  <h2 className="qf-resolution-mobile-next-title">
                    Update proposal
                  </h2>
                ) : null}
                <div className="qf-resolution-mobile-actions">
                  {showUpdateProposal ? (
                    <a href={updateHref} className="qf-btn-primary">
                      Update proposal
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="qf-btn-secondary"
                    onClick={() => focusProposalConversationComposer()}
                  >
                    Reply to customer
                  </button>
                  <button
                    type="button"
                    className="qf-btn-secondary"
                    onClick={persistResolved}
                  >
                    Mark resolved
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
