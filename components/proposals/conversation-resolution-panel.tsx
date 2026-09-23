"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { markChangeRequestResolved } from "@/lib/proposals/change-request/actions";
import {
  buildCalendarActionHref,
  type ConversationResolutionSummary,
} from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import {
  acceptLabelForRequestedSchedule,
  promptForRequestedSchedule,
  scheduleFieldLabel,
  suggestLabelForRequestedSchedule,
} from "@/lib/proposals/change-request/requested-schedule";
import {
  beginResolutionDismiss,
  completeResolutionDismiss,
  dispatchResolutionAccepted,
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

function AvailabilityLine({
  availability,
}: {
  availability: ConversationResolutionSummary["requestedAvailability"];
}) {
  if (availability === "available") {
    return (
      <p className="qf-resolution-availability qf-resolution-availability-yes">
        ✓ Available
      </p>
    );
  }
  if (availability === "unavailable") {
    return (
      <p className="qf-resolution-availability qf-resolution-availability-no">
        Not available
      </p>
    );
  }
  return null;
}

function AcceptRequestedFields({
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
  const [scheduleAccepted, setScheduleAccepted] = useState(false);
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
  const showSchedule =
    summary.hasScheduleRequest &&
    !scheduleAccepted &&
    !dateCard;
  const requestedValue = summary.requestedDisplayValue;
  const acceptLabel = acceptLabelForRequestedSchedule(summary.requestedKind);
  const suggestLabel = suggestLabelForRequestedSchedule(summary.requestedKind);
  const requestPrompt = promptForRequestedSchedule(summary.requestedKind);

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

  function onAcceptRequested() {
    const label = summary.requestedDisplayValue;
    if (label) {
      dispatchResolutionAccepted({
        label,
        booked: true,
      });
    }
    if (summary.hasJobRequest) {
      setScheduleAccepted(true);
      return;
    }
    if (optRef.current.pending || optRef.current.dismissed) {
      return;
    }
    const next = beginResolutionDismiss(optRef.current);
    optRef.current = next;
    setOpt(next);
    dispatchResolutionDismissed();
  }

  useEffect(() => {
    if (!acceptRequestedState.error) {
      return;
    }
    if (optRef.current.dismissed) {
      const failed = failResolutionDismiss(
        optRef.current,
        acceptRequestedState.error
      );
      optRef.current = failed;
      setOpt(failed);
      dispatchResolutionRestored();
    }
    setScheduleAccepted(false);
  }, [acceptRequestedState.error]);

  if (opt.dismissed && !summary.hasJobRequest) {
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
              <p className="qf-resolution-banner-title">
                {summary.hasJobRequest && summary.hasScheduleRequest
                  ? "Requested changes"
                  : showSchedule
                    ? summary.mobileHeadline
                    : summary.hasJobRequest
                      ? "Customer requested a change to the job"
                      : "Customer request"}
              </p>
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

              {showSchedule ? (
                <div className="qf-resolution-block qf-resolution-requested">
                  <h3 className="qf-resolution-label">
                    {scheduleFieldLabel(summary.requestedKind)}
                  </h3>
                  {requestedValue ? (
                    <p className="qf-resolution-requested-value">{requestedValue}</p>
                  ) : (
                    <p className="qf-resolution-copy">
                      The customer asked to change the date or time, but did not
                      give an exact value.
                    </p>
                  )}
                  <AvailabilityLine availability={summary.requestedAvailability} />
                  {requestedValue ? (
                    <p className="qf-resolution-copy">{requestPrompt}</p>
                  ) : null}
                </div>
              ) : null}

              {summary.hasJobRequest ? (
                <div className="qf-resolution-block">
                  <h3 className="qf-resolution-label">Job details</h3>
                  <ul className="qf-resolution-request-list">
                    {summary.outstandingItems
                      .filter((item) => item.kind === "job")
                      .map((item) => (
                        <li key={item.title}>
                          {item.detail || "Customer requested a change to the job"}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {!showSchedule && !summary.hasJobRequest ? (
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
              ) : null}

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
              {showSchedule && summary.showAcceptRequestedDate ? (
                <div className="qf-resolution-action-option">
                  <form action={acceptRequestedAction} onSubmit={onAcceptRequested}>
                    <AcceptRequestedFields
                      proposalId={proposalId}
                      summary={summary}
                    />
                    <DateActionButton
                      label={
                        summary.requestedAvailability === "available"
                          ? "Accept"
                          : acceptLabel
                      }
                      pendingLabel="Booking…"
                    />
                  </form>
                  <p className="qf-resolution-action-hint">
                    {requestedValue
                      ? `Books ${requestedValue} because the customer asked for it.`
                      : "Agree to the customer's requested date and book the job."}
                  </p>
                </div>
              ) : null}
              {showSchedule ? (
                <div className="qf-resolution-action-option">
                  <form action={holdAction}>
                    <input type="hidden" name="proposalId" value={proposalId} />
                    <label className="qf-resolution-action-hint" htmlFor="suggest-date">
                      {suggestLabel}
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
                      label={suggestLabel}
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
                    Edit proposal
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
                  Reply
                </button>
                <p className="qf-resolution-action-hint">
                  Continue the conversation
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
            {summary.hasJobRequest && showSchedule ? (
              <>
                <p className="qf-resolution-mobile-headline">Requested changes</p>
                <ol className="qf-resolution-outstanding">
                  {showSchedule ? (
                    <li>
                      <span className="qf-resolution-outstanding-title">
                        Date/time
                      </span>
                      <span className="qf-resolution-requested-value">
                        {requestedValue || "Date or time change"}
                      </span>
                    </li>
                  ) : null}
                  <li>
                    <span className="qf-resolution-outstanding-title">
                      Job details
                    </span>
                    <span>
                      {summary.outstandingItems.find((item) => item.kind === "job")
                        ?.detail || "Customer requested a change to the job"}
                    </span>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p className="qf-resolution-mobile-headline">
                  {summary.mobileHeadline}
                </p>
                <p
                  className={
                    requestedValue && showSchedule
                      ? "qf-resolution-requested-value"
                      : "qf-resolution-mobile-description"
                  }
                >
                  {showSchedule
                    ? requestedValue || summary.mobileDescription
                    : summary.mobileDescription}
                </p>
              </>
            )}
            {showSchedule ? (
              <AvailabilityLine availability={summary.requestedAvailability} />
            ) : null}
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
            ) : showSchedule ? (
              <>
                {requestedValue ? (
                  <p className="qf-resolution-mobile-description">{requestPrompt}</p>
                ) : null}
                <div className="qf-resolution-mobile-actions">
                  {summary.showAcceptRequestedDate ? (
                    <form
                      action={acceptRequestedAction}
                      onSubmit={onAcceptRequested}
                    >
                      <AcceptRequestedFields
                        proposalId={proposalId}
                        summary={summary}
                      />
                      <DateActionButton
                        label={
                          summary.requestedAvailability === "available"
                            ? "Accept"
                            : acceptLabel
                        }
                        pendingLabel="Booking…"
                      />
                    </form>
                  ) : null}
                  <form action={holdAction}>
                    <input type="hidden" name="proposalId" value={proposalId} />
                    <input type="date" name="plannedStartDateExact" required />
                    <input type="time" name="plannedStartTime" required />
                    <DateActionButton
                      label={
                        summary.requestedAvailability === "unavailable"
                          ? suggestLabel
                          : "Suggest another"
                      }
                      pendingLabel="Sending…"
                      variant="secondary"
                    />
                  </form>
                  {summary.hasJobRequest ? (
                    <>
                      <a href={updateHref} className="qf-btn-secondary">
                        Edit proposal
                      </a>
                      <button
                        type="button"
                        className="qf-btn-secondary"
                        onClick={() => focusProposalConversationComposer()}
                      >
                        Reply
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                {showUpdateProposal ? (
                  <h2 className="qf-resolution-mobile-next-title">
                    Customer requested a change to the job
                  </h2>
                ) : null}
                <div className="qf-resolution-mobile-actions">
                  {showUpdateProposal ? (
                    <a href={updateHref} className="qf-btn-primary">
                      Edit proposal
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="qf-btn-secondary"
                    onClick={() => focusProposalConversationComposer()}
                  >
                    Reply
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
