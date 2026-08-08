/**
 * Controlled next actions after a trader accepts a proposed update (50C.1.5a).
 *
 * Creating or updating a RevisionAction never writes proposal, job, calendar,
 * or email data. Opening an action only navigates to an existing tool.
 */

import type { RevisionSuggestionType } from "@/lib/proposals/revision/types";

export const REVISION_ACTION_STATUSES = [
  "pending",
  "opened",
  "completed",
  "skipped",
] as const;

export type RevisionActionStatus = (typeof REVISION_ACTION_STATUSES)[number];

export const REVISION_ACTION_TYPES = [
  "open_calendar",
  "update_materials",
  "review_scope_and_price",
  "review_extra_work_and_price",
  "review_price",
  "update_duration",
  "update_details",
] as const;

export type RevisionActionType = (typeof REVISION_ACTION_TYPES)[number];

/** Prefill hints for later tools — never applied automatically. */
export type RevisionActionPayload = {
  suggestionType: RevisionSuggestionType;
  evidenceQuote: string;
  /** Accepted or trader-edited suggestion text. */
  suggestedChange: string;
  plannedStartText?: string | null;
  plannedStartExact?: string | null;
  materialsHint?: string | null;
  scopeHint?: string | null;
  note?: string | null;
};

export type RevisionAction = {
  id: string;
  proposalId: string;
  suggestionId: string;
  actionType: RevisionActionType;
  payload: RevisionActionPayload;
  status: RevisionActionStatus;
  createdAt: string;
  updatedAt: string;
};
