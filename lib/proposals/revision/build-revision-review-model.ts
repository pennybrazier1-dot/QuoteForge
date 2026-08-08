import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { buildRevisionSuggestions } from "@/lib/proposals/revision/build-revision-suggestions";
import type {
  ProposalRevisionReviewModel,
  ProposalRevisionSummary,
  RevisedProposalDraft,
} from "@/lib/proposals/revision/types";
import { mapDbRowToStructuredProposal } from "@/lib/proposals/structured-proposal";

export type RevisionReviewProposalSource = {
  id: string;
  proposal_number: string;
  title: string | null;
  customer_name: string | null;
  total_amount: number;
  estimated_duration: string | null;
  planned_start_date_text: string | null;
  planned_start_date: string | null;
  job_summary: string | null;
  scope_of_work: string | null;
  materials: unknown;
  labour_description: string | null;
  things_to_confirm_items: unknown;
  ai_optional_extras: unknown;
  payment_terms: string | null;
  rough_notes?: string | null;
};

function formatPlannedStart(proposal: RevisionReviewProposalSource): string | null {
  const text = proposal.planned_start_date_text?.trim();
  if (text) {
    return text;
  }
  if (proposal.planned_start_date) {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
      new Date(proposal.planned_start_date)
    );
  }
  return null;
}

export function buildProposalRevisionSummary(
  proposal: RevisionReviewProposalSource
): ProposalRevisionSummary {
  const structured = mapDbRowToStructuredProposal(proposal);

  return {
    proposalId: proposal.id,
    proposalNumber: proposal.proposal_number,
    title: proposal.title?.trim() || `Proposal ${proposal.proposal_number}`,
    customerName: proposal.customer_name,
    priceLabel: formatPenceAsGbp(proposal.total_amount),
    duration: proposal.estimated_duration?.trim() || null,
    plannedStart: formatPlannedStart(proposal),
    jobSummary:
      structured?.jobSummary?.trim() ||
      proposal.rough_notes?.trim() ||
      null,
    scopeOfWork: structured?.scopeOfWork ?? [],
    materials: structured?.materials ?? [],
    optionalExtras: structured?.optionalExtras ?? [],
  };
}

export function buildRevisedProposalDraftShell(
  proposalId: string,
  messages: ProposalCustomerMessage[]
): RevisedProposalDraft {
  return {
    proposalId,
    status: "reviewing",
    sourceMessageIds: messages.map((message) => message.id),
    decisions: [],
    fieldPatches: [],
  };
}

/**
 * Read-only review model for the Revision Review screen.
 * Does not write to the database.
 */
export function buildProposalRevisionReviewModel(
  proposal: RevisionReviewProposalSource,
  messages: ProposalCustomerMessage[]
): ProposalRevisionReviewModel {
  return {
    summary: buildProposalRevisionSummary(proposal),
    suggestions: buildRevisionSuggestions(messages),
    draftShell: buildRevisedProposalDraftShell(proposal.id, messages),
  };
}

/**
 * Builds an in-memory draft from trader decisions for later preview/resend steps.
 * Never applies field patches in 50C.1.
 */
export function buildRevisedProposalDraftFromDecisions(input: {
  proposalId: string;
  sourceMessageIds: string[];
  decisions: RevisedProposalDraft["decisions"];
}): RevisedProposalDraft {
  const hasAccepted = input.decisions.some(
    (item) => item.decision === "accepted" || item.decision === "edited"
  );

  return {
    proposalId: input.proposalId,
    status: hasAccepted ? "ready_to_preview" : "reviewing",
    sourceMessageIds: input.sourceMessageIds,
    decisions: input.decisions,
    fieldPatches: [],
  };
}
