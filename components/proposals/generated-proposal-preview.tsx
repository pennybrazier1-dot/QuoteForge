import type { GeneratedProposal } from "@/lib/ai";
import { StructuredProposalContent } from "@/components/proposals/structured-proposal-content";
import { SectionCard } from "@/components/ui/section-card";

export function GeneratedProposalPreview({
  proposal,
}: {
  proposal: GeneratedProposal;
}) {
  return (
    <SectionCard variant="accent">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Proposal preview</h3>
          <p className="mt-1 text-sm text-muted">
            Review carefully, then use Create proposal below to save it as your
            official Reanvil proposal.
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          AI draft
        </span>
      </div>

      <div className="mt-6">
        <StructuredProposalContent proposal={proposal} />
      </div>
    </SectionCard>
  );
}
