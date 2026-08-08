/**
 * Proposal revision review types (Phase 50C.1).
 *
 * Suggestions are review-only. Nothing here writes proposal fields,
 * prices, calendar events, or customer emails.
 */

export const REVISION_SUGGESTION_TYPES = [
  "scope",
  "materials",
  "extra_work",
  "price",
  "duration",
  "start_date",
  "details",
] as const;

export type RevisionSuggestionType = (typeof REVISION_SUGGESTION_TYPES)[number];

export type RevisionSuggestionConfidence = "high" | "medium" | "low";

export type RevisionSuggestionDecision =
  | "pending"
  | "accepted"
  | "edited"
  | "rejected";

/** Mapped proposal columns for a future apply step — unused in 50C.1. */
export type RevisedProposalFieldKey =
  | "scope_of_work"
  | "materials"
  | "ai_optional_extras"
  | "total_amount"
  | "estimated_duration"
  | "planned_start"
  | "things_to_confirm"
  | "job_summary";

export type RevisionSuggestion = {
  id: string;
  type: RevisionSuggestionType;
  evidenceQuote: string;
  evidenceMessageId: string;
  suggestedChange: string;
  confidence: RevisionSuggestionConfidence;
  needsReview: boolean;
  targetField: RevisedProposalFieldKey | null;
  /** Extracted human value when available (e.g. agreed date label). */
  resolvedValue?: string | null;
  /** Parsed calendar date YYYY-MM-DD when available. */
  resolvedDateIso?: string | null;
};

export type ProposalRevisionSummary = {
  proposalId: string;
  proposalNumber: string;
  title: string;
  customerName: string | null;
  priceLabel: string;
  duration: string | null;
  plannedStart: string | null;
  jobSummary: string | null;
  scopeOfWork: string[];
  materials: string[];
  optionalExtras: string[];
};

/**
 * Shell for later preview / resend workflow.
 * 50C.1 builds this in memory only — never persisted, never applied.
 */
export type RevisedProposalDraftStatus =
  | "reviewing"
  | "ready_to_preview"
  | "ready_to_send";

export type RevisedProposalDraftDecision = {
  suggestionId: string;
  decision: Exclude<RevisionSuggestionDecision, "pending">;
  /** Trader-edited suggestion text when decision is "edited". */
  editedSuggestedChange?: string;
};

export type RevisedFieldPatch = {
  field: RevisedProposalFieldKey;
  /** Human-readable proposed value — apply step not built yet. */
  proposedValue: string;
  fromSuggestionIds: string[];
};

export type RevisedProposalDraft = {
  proposalId: string;
  status: RevisedProposalDraftStatus;
  sourceMessageIds: string[];
  decisions: RevisedProposalDraftDecision[];
  /** Reserved for later apply — always empty in 50C.1. */
  fieldPatches: RevisedFieldPatch[];
};

export type ProposalRevisionReviewModel = {
  summary: ProposalRevisionSummary;
  suggestions: RevisionSuggestion[];
  /** Placeholder draft so later steps can extend without reshaping. */
  draftShell: RevisedProposalDraft;
};
