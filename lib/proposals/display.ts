export type ProposalSummarySource = {
  job_summary: string | null;
  rough_notes: string | null;
  title: string;
};

function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function getProposalSummaryLabel(proposal: ProposalSummarySource): string {
  const jobSummary = proposal.job_summary?.trim();

  if (jobSummary) {
    return truncate(jobSummary);
  }

  if (proposal.rough_notes) {
    const firstLine = proposal.rough_notes.split("\n")[0]?.trim();

    if (firstLine) {
      return truncate(firstLine);
    }
  }

  return proposal.title;
}

export function formatProposalCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}
