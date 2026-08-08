import type { RevisionSuggestion } from "@/lib/proposals/revision/types";
import { parseFlexibleDateToIso } from "@/lib/proposals/revision/conversation-agreements";
import type {
  RevisionAction,
  RevisionActionPayload,
  RevisionActionStatus,
  RevisionActionType,
} from "@/lib/proposals/revision/revision-action-types";
import { buildScheduleWorkspacePath } from "@/lib/proposals/schedule/schedule-fields";

export function actionTypeForSuggestionType(
  suggestionType: RevisionSuggestion["type"]
): RevisionActionType {
  switch (suggestionType) {
    case "start_date":
      return "open_calendar";
    case "materials":
      return "update_materials";
    case "scope":
      return "review_scope_and_price";
    case "extra_work":
      return "review_extra_work_and_price";
    case "price":
      return "review_price";
    case "duration":
      return "update_duration";
    case "details":
      return "update_details";
  }
}

export function formatRevisionActionType(actionType: RevisionActionType): string {
  switch (actionType) {
    case "open_calendar":
      return "Open calendar";
    case "update_materials":
      return "Update materials";
    case "review_scope_and_price":
      return "Review scope & price";
    case "review_extra_work_and_price":
      return "Review extra work & price";
    case "review_price":
      return "Review price";
    case "update_duration":
      return "Update duration";
    case "update_details":
      return "Capture details";
  }
}

export function formatRevisionActionDescription(
  actionType: RevisionActionType
): string {
  switch (actionType) {
    case "open_calendar":
      return "Opens booking with the suggested date prefilled, plus your availability. Nothing is saved until you confirm.";
    case "update_materials":
      return "Open the proposal materials area. Live materials are not changed until you save.";
    case "review_scope_and_price":
      return "Review scope impact and price on the proposal. No fields are updated automatically.";
    case "review_extra_work_and_price":
      return "Review extra work and whether price should change. No automatic updates.";
    case "review_price":
      return "Review pricing on the proposal. Price is not changed until you edit and save.";
    case "update_duration":
      return "Review estimated duration on the proposal. Duration is not changed automatically.";
    case "update_details":
      return "Review details to capture on the proposal. Nothing is written automatically.";
  }
}

export function formatRevisionActionStatus(status: RevisionActionStatus): string {
  switch (status) {
    case "pending":
      return "Action needed";
    case "opened":
      return "Opened";
    case "completed":
      return "Done";
    case "skipped":
      return "Skipped";
  }
}

export function buildRevisionActionPayload(
  suggestion: RevisionSuggestion,
  acceptedSuggestedChange: string
): RevisionActionPayload {
  const text = acceptedSuggestedChange.trim() || suggestion.suggestedChange;
  const plannedStartText =
    suggestion.type === "start_date"
      ? suggestion.resolvedValue || suggestion.resolvedDateIso || text
      : null;
  const plannedStartExact =
    suggestion.type === "start_date"
      ? suggestion.resolvedDateIso ||
        parseFlexibleDateToIso(suggestion.resolvedValue || text)
      : null;

  return {
    suggestionType: suggestion.type,
    evidenceQuote: suggestion.evidenceQuote,
    suggestedChange: text,
    plannedStartText,
    plannedStartExact,
    materialsHint: suggestion.type === "materials" ? text : null,
    scopeHint:
      suggestion.type === "scope" || suggestion.type === "extra_work"
        ? text
        : null,
    note: text,
  };
}

/**
 * Creates a pending revision action from an accepted/edited suggestion.
 * Does not write to proposals, jobs, calendar, or email.
 */
export function createRevisionActionFromSuggestion(input: {
  proposalId: string;
  suggestion: RevisionSuggestion;
  acceptedSuggestedChange: string;
  now?: Date;
}): RevisionAction {
  const now = (input.now ?? new Date()).toISOString();
  const actionType = actionTypeForSuggestionType(input.suggestion.type);

  return {
    id: `raction-${input.suggestion.id}`,
    proposalId: input.proposalId,
    suggestionId: input.suggestion.id,
    actionType,
    payload: buildRevisionActionPayload(
      input.suggestion,
      input.acceptedSuggestedChange
    ),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export function withRevisionActionStatus(
  action: RevisionAction,
  status: RevisionActionStatus,
  now?: Date
): RevisionAction {
  return {
    ...action,
    status,
    updatedAt: (now ?? new Date()).toISOString(),
  };
}

/**
 * Navigation target for the next-action button.
 * Opening this URL must not itself mutate proposal/job/calendar data.
 */
export function buildRevisionActionHref(action: RevisionAction): string {
  const proposalPath = `/proposals/${action.proposalId}`;
  const params = new URLSearchParams();
  params.set("revisionActionId", action.id);

  if (action.payload.plannedStartText) {
    params.set("plannedStartHint", action.payload.plannedStartText);
  }
  if (action.payload.plannedStartExact) {
    params.set("plannedStartExact", action.payload.plannedStartExact);
  }

  switch (action.actionType) {
    case "open_calendar": {
      const base = buildScheduleWorkspacePath(action.proposalId, {
        suggestedDateText: action.payload.plannedStartText,
        suggestedDateExact: action.payload.plannedStartExact,
      });
      const joiner = base.includes("?") ? "&" : "?";
      return `${base}${joiner}revisionActionId=${encodeURIComponent(action.id)}`;
    }
    case "update_materials":
      return `${proposalPath}?${params.toString()}#job-preparation`;
    case "review_scope_and_price":
    case "review_extra_work_and_price":
    case "review_price":
    case "update_duration":
    case "update_details":
      return `${proposalPath}?${params.toString()}#change-request-review-target`;
  }
}
