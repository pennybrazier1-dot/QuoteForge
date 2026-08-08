"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProposalConversationThread } from "@/components/proposals/proposal-conversation-thread";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  buildRevisionActionHref,
  createRevisionActionFromSuggestion,
  formatRevisionActionDescription,
  formatRevisionActionStatus,
  formatRevisionActionType,
  withRevisionActionStatus,
} from "@/lib/proposals/revision/build-revision-action";
import {
  formatRevisionConfidence,
  formatRevisionSuggestionType,
} from "@/lib/proposals/revision/build-revision-suggestions";
import { buildRevisedProposalDraftFromDecisions } from "@/lib/proposals/revision/build-revision-review-model";
import type { RevisionAction } from "@/lib/proposals/revision/revision-action-types";
import type {
  ProposalRevisionReviewModel,
  RevisionSuggestion,
  RevisionSuggestionDecision,
} from "@/lib/proposals/revision/types";

type DecisionState = {
  decision: RevisionSuggestionDecision;
  editedText: string;
};

function initialDecisions(
  suggestions: RevisionSuggestion[]
): Record<string, DecisionState> {
  return Object.fromEntries(
    suggestions.map((suggestion) => [
      suggestion.id,
      {
        decision: "pending" as const,
        editedText: suggestion.suggestedChange,
      },
    ])
  );
}

export function ProposalRevisionReview({
  model,
  messages,
}: {
  model: ProposalRevisionReviewModel;
  messages: ProposalCustomerMessage[];
}) {
  const [decisions, setDecisions] = useState(() =>
    initialDecisions(model.suggestions)
  );
  const [actionsBySuggestionId, setActionsBySuggestionId] = useState<
    Record<string, RevisionAction>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const draft = useMemo(() => {
    const resolved = Object.entries(decisions)
      .filter(([, value]) => value.decision !== "pending")
      .map(([suggestionId, value]) => ({
        suggestionId,
        decision: value.decision as Exclude<
          RevisionSuggestionDecision,
          "pending"
        >,
        editedSuggestedChange:
          value.decision === "edited" ? value.editedText : undefined,
      }));

    return buildRevisedProposalDraftFromDecisions({
      proposalId: model.summary.proposalId,
      sourceMessageIds: model.draftShell.sourceMessageIds,
      decisions: resolved,
    });
  }, [decisions, model.draftShell.sourceMessageIds, model.summary.proposalId]);

  const pendingCount = model.suggestions.filter(
    (item) => decisions[item.id]?.decision === "pending"
  ).length;
  const acceptedCount = model.suggestions.filter((item) => {
    const decision = decisions[item.id]?.decision;
    return decision === "accepted" || decision === "edited";
  }).length;
  const rejectedCount = model.suggestions.filter(
    (item) => decisions[item.id]?.decision === "rejected"
  ).length;
  const openActionCount = Object.values(actionsBySuggestionId).filter(
    (action) => action.status === "pending" || action.status === "opened"
  ).length;

  const acceptSuggestion = (
    suggestion: RevisionSuggestion,
    decision: "accepted" | "edited",
    acceptedText: string
  ) => {
    setDecisions((current) => ({
      ...current,
      [suggestion.id]: {
        ...current[suggestion.id],
        decision,
        editedText: acceptedText,
      },
    }));
    setEditingId(null);
    setActionsBySuggestionId((current) => ({
      ...current,
      [suggestion.id]: createRevisionActionFromSuggestion({
        proposalId: model.summary.proposalId,
        suggestion,
        acceptedSuggestedChange: acceptedText,
      }),
    }));
  };

  const rejectSuggestion = (suggestionId: string) => {
    setDecisions((current) => ({
      ...current,
      [suggestionId]: {
        ...current[suggestionId],
        decision: "rejected",
      },
    }));
    setEditingId(null);
    setActionsBySuggestionId((current) => {
      const next = { ...current };
      delete next[suggestionId];
      return next;
    });
  };

  const skipAction = (suggestionId: string) => {
    setActionsBySuggestionId((current) => {
      const existing = current[suggestionId];
      if (!existing) {
        return current;
      }
      return {
        ...current,
        [suggestionId]: withRevisionActionStatus(existing, "skipped"),
      };
    });
  };

  const openAction = (suggestionId: string) => {
    setActionsBySuggestionId((current) => {
      const existing = current[suggestionId];
      if (!existing) {
        return current;
      }
      return {
        ...current,
        [suggestionId]: withRevisionActionStatus(existing, "opened"),
      };
    });
  };

  const summary = model.summary;

  return (
    <div className="qf-revision-page qf-workspace-page qf-mobile-safe">
      <header className="qf-revision-header">
        <div className="qf-revision-header-top">
          <p className="qf-workspace-number">{summary.proposalNumber}</p>
          <Link
            href={`/proposals/${summary.proposalId}`}
            className="qf-btn-secondary"
          >
            Back to proposal
          </Link>
        </div>
        <h1 className="qf-revision-title">Review changes</h1>
        <p className="qf-revision-intro">
          Proposed updates from the conversation only. Accepting creates a next
          action — it does not change the proposal, job, calendar, or send
          email.
        </p>
      </header>

      <div className="qf-revision-banner" role="status">
        <p className="qf-revision-banner-title">Proposed update — you decide</p>
        <p className="qf-revision-banner-copy">
          Accept a proposed update to get a controlled next step. You still
          confirm any real change in the linked tool.
        </p>
      </div>

      <section className="qf-revision-card" aria-label="Current proposal">
        <h2 className="qf-revision-card-title">Current proposal</h2>
        <dl className="qf-revision-summary-grid">
          <div>
            <dt>Customer</dt>
            <dd>{summary.customerName || "Not set"}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{summary.priceLabel}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{summary.duration || "Not set"}</dd>
          </div>
          <div>
            <dt>Planned start</dt>
            <dd>{summary.plannedStart || "Not set"}</dd>
          </div>
        </dl>
        {summary.jobSummary ? (
          <div className="qf-revision-summary-block">
            <h3>Summary</h3>
            <p>{summary.jobSummary}</p>
          </div>
        ) : null}
        {summary.scopeOfWork.length > 0 ? (
          <div className="qf-revision-summary-block">
            <h3>Scope</h3>
            <ul>
              {summary.scopeOfWork.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {summary.materials.length > 0 ? (
          <div className="qf-revision-summary-block">
            <h3>Materials</h3>
            <ul>
              {summary.materials.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="qf-revision-card" aria-label="Conversation evidence">
        <h2 className="qf-revision-card-title">Conversation evidence</h2>
        <p className="qf-revision-card-copy">
          Suggestions are based on this thread. History is not changed.
        </p>
        <div className="qf-revision-thread">
          <ProposalConversationThread
            messages={messages}
            viewer="trader"
            emptyMessage="No messages yet. Ask the customer for changes first."
            variant="workspace"
          />
        </div>
      </section>

      <section className="qf-revision-card" aria-label="Proposed updates">
        <h2 className="qf-revision-card-title">Proposed updates</h2>
        {model.suggestions.length === 0 ? (
          <p className="qf-revision-card-copy">
            No clear customer requests to act on yet. Reply in the conversation,
            then open this screen again.
          </p>
        ) : (
          <ul className="qf-revision-suggestion-list">
            {model.suggestions.map((suggestion) => {
              const state = decisions[suggestion.id];
              const action = actionsBySuggestionId[suggestion.id];
              const isEditing = editingId === suggestion.id;
              const isAccepted =
                state.decision === "accepted" || state.decision === "edited";
              return (
                <li
                  key={suggestion.id}
                  className={`qf-revision-suggestion qf-revision-suggestion--${state.decision}`}
                >
                  <div className="qf-revision-suggestion-meta">
                    <span className="qf-revision-suggestion-type">
                      {formatRevisionSuggestionType(suggestion.type)}
                    </span>
                    <span className="qf-revision-suggestion-confidence">
                      {formatRevisionConfidence(suggestion.confidence)}
                      {suggestion.needsReview ? " · Needs review" : ""}
                    </span>
                  </div>

                  <div className="qf-revision-suggestion-block">
                    <h3>Customer request</h3>
                    <p className="qf-revision-quote">
                      “{suggestion.evidenceQuote}”
                    </p>
                  </div>

                  <div className="qf-revision-suggestion-block">
                    <h3>Proposed update</h3>
                    {isEditing ? (
                      <textarea
                        className="qf-revision-edit-textarea"
                        rows={3}
                        value={state.editedText}
                        onChange={(event) =>
                          setDecisions((current) => ({
                            ...current,
                            [suggestion.id]: {
                              ...current[suggestion.id],
                              editedText: event.target.value,
                            },
                          }))
                        }
                      />
                    ) : (
                      <p>
                        {state.decision === "edited"
                          ? state.editedText
                          : suggestion.suggestedChange}
                      </p>
                    )}
                  </div>

                  <p className="qf-revision-decision-label">
                    Decision: {formatDecision(state.decision)}
                  </p>

                  <div className="qf-revision-suggestion-actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="qf-btn-primary"
                          onClick={() => {
                            if (!state.editedText.trim()) {
                              return;
                            }
                            acceptSuggestion(
                              suggestion,
                              "edited",
                              state.editedText.trim()
                            );
                          }}
                        >
                          Save edit
                        </button>
                        <button
                          type="button"
                          className="qf-btn-secondary"
                          onClick={() => {
                            setDecisions((current) => ({
                              ...current,
                              [suggestion.id]: {
                                ...current[suggestion.id],
                                editedText: suggestion.suggestedChange,
                              },
                            }));
                            setEditingId(null);
                          }}
                        >
                          Cancel edit
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="qf-btn-primary"
                          onClick={() =>
                            acceptSuggestion(
                              suggestion,
                              "accepted",
                              suggestion.suggestedChange
                            )
                          }
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="qf-btn-secondary"
                          onClick={() => setEditingId(suggestion.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="qf-btn-secondary"
                          onClick={() => rejectSuggestion(suggestion.id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>

                  {isAccepted && action ? (
                    <div
                      className={`qf-revision-next-action qf-revision-next-action--${action.status}`}
                    >
                      <div className="qf-revision-next-action-header">
                        <h3>Next action</h3>
                        <span className="qf-revision-next-action-status">
                          {formatRevisionActionStatus(action.status)}
                        </span>
                      </div>
                      <p className="qf-revision-next-action-title">
                        {formatRevisionActionType(action.actionType)}
                      </p>
                      <p className="qf-revision-next-action-copy">
                        {formatRevisionActionDescription(action.actionType)}
                      </p>
                      {action.payload.plannedStartText ? (
                        <p className="qf-revision-next-action-prefill">
                          Prefill: {action.payload.plannedStartText}
                          {action.payload.plannedStartExact
                            ? ` (${action.payload.plannedStartExact})`
                            : ""}
                        </p>
                      ) : null}
                      {action.status === "skipped" ? (
                        <p className="qf-revision-next-action-copy">
                          Skipped — proposed update stays accepted, but no next
                          step is queued.
                        </p>
                      ) : (
                        <div className="qf-revision-next-action-buttons">
                          <Link
                            href={buildRevisionActionHref(action)}
                            className="qf-btn-primary"
                            onClick={() => openAction(suggestion.id)}
                          >
                            {formatRevisionActionType(action.actionType)}
                          </Link>
                          <button
                            type="button"
                            className="qf-btn-secondary"
                            onClick={() => skipAction(suggestion.id)}
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="qf-revision-footer">
        <div className="qf-revision-footer-stats">
          <span>{pendingCount} pending</span>
          <span>{acceptedCount} accepted</span>
          <span>{rejectedCount} rejected</span>
          <span>{openActionCount} next actions open</span>
        </div>
        <p className="qf-revision-footer-note">
          Draft status for later steps:{" "}
          <strong>{draft.status.replaceAll("_", " ")}</strong>. Accepted
          actions do not write live proposal or job data.
        </p>
        <div className="qf-revision-footer-actions">
          <Link
            href={`/proposals/${summary.proposalId}`}
            className="qf-btn-secondary"
          >
            Back to proposal
          </Link>
          <button
            type="button"
            className="qf-btn-primary"
            disabled
            title="Coming next — preview and resend"
          >
            Preview revised proposal (soon)
          </button>
        </div>
      </footer>
    </div>
  );
}

function formatDecision(decision: RevisionSuggestionDecision): string {
  switch (decision) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "edited":
      return "Edited";
    case "rejected":
      return "Rejected";
  }
}
