import {
  isLongProposalScope,
  resolveProposalEmailJobTitle,
  shortenScopeToJobTitle,
} from "@/lib/email/proposal-email-presentation";

/** Short job identity for the trader workspace header. Never the full scope. */
export function resolveWorkspaceJobTitle(input: {
  title?: string | null;
  jobSummary?: string | null;
  proposalNumber?: string | null;
}): string | null {
  const title = resolveProposalEmailJobTitle({
    title: input.title,
    jobSummary: input.jobSummary,
    proposalNumber: input.proposalNumber,
  });
  if (title && !/^your proposal$/i.test(title) && !isLongProposalScope(title)) {
    return title;
  }
  return (
    shortenScopeToJobTitle(input.title) ??
    shortenScopeToJobTitle(input.jobSummary)
  );
}
