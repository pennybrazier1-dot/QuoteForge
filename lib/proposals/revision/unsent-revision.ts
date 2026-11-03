import { normalizeProposalStatus } from "@/lib/proposals/status";

/**
 * A saved revision that has not yet been issued to the customer.
 */
export function hasUnsentRevision(input: {
  unsent_revision_at?: string | null;
}): boolean {
  return Boolean(input.unsent_revision_at);
}

/**
 * Whether the live proposal content is an issued revision the customer may accept.
 *
 * Original quotes: content_revision = 0 (issued stamp not required).
 * Revised quotes: content_revision must equal issued_content_revision and
 * unsent_revision_at must be clear.
 */
export function isRevisionReadyForAcceptance(input: {
  unsent_revision_at?: string | null;
  content_revision?: number | null;
  issued_content_revision?: number | null;
}): boolean {
  if (hasUnsentRevision(input)) {
    return false;
  }
  const contentRevision = Number(input.content_revision ?? 0);
  if (!Number.isFinite(contentRevision) || contentRevision < 0) {
    return false;
  }
  if (contentRevision === 0) {
    return true;
  }
  const issued = Number(input.issued_content_revision ?? NaN);
  return Number.isFinite(issued) && issued === contentRevision;
}

/**
 * Soft UI / precheck: block accept when the live row is not ready.
 * Does not replace server-side expected-revision matching.
 */
export function isCustomerAcceptanceBlockedByRevision(input: {
  unsent_revision_at?: string | null;
  content_revision?: number | null;
  issued_content_revision?: number | null;
}): boolean {
  return !isRevisionReadyForAcceptance(input);
}

/**
 * True when the customer's submitted expected revision matches the live
 * issued revision (or original revision 0).
 */
export function matchesExpectedAcceptanceRevision(input: {
  expectedContentRevision: number;
  unsent_revision_at?: string | null;
  content_revision?: number | null;
  issued_content_revision?: number | null;
}): boolean {
  if (!Number.isFinite(input.expectedContentRevision)) {
    return false;
  }
  if (!isRevisionReadyForAcceptance(input)) {
    return false;
  }
  return Number(input.content_revision ?? 0) === input.expectedContentRevision;
}

export function canReviseProposalStatus(status: string): boolean {
  return normalizeProposalStatus(status) === "needs_attention";
}

export function canIssueRevisedProposal(input: {
  status: string;
  unsent_revision_at?: string | null;
  content_revision?: number | null;
  total_amount?: number | null;
}): boolean {
  if (!canReviseProposalStatus(input.status)) {
    return false;
  }
  if (!hasUnsentRevision(input)) {
    return false;
  }
  const revision = Number(input.content_revision ?? 0);
  if (!Number.isFinite(revision) || revision <= 0) {
    return false;
  }
  const total = Number(input.total_amount ?? 0);
  return Number.isFinite(total) && total > 0;
}

export function unsentRevisionAcceptError(): string {
  return "An updated proposal is being prepared. Please wait for the revised proposal before accepting.";
}

export function revisedProposalAcceptError(): string {
  return "This quote has been updated. Please refresh the page and review the new total before accepting.";
}

export function staleRevisionAcceptError(): string {
  return "This quote has been updated. Please refresh the page and review the new total before accepting.";
}

export function notIssuedRevisionAcceptError(): string {
  return "This updated quote is not ready to accept yet. Please wait for the issued proposal.";
}
