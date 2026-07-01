import { StructuredProposalContent } from "@/components/proposals/structured-proposal-content";
import type { StructuredProposalData } from "@/lib/proposals/structured-proposal";
import { SectionCard } from "@/components/ui/section-card";

export function StructuredProposalView({
  proposal,
}: {
  proposal: StructuredProposalData;
}) {
  return (
    <SectionCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Proposal</h3>
          <p className="mt-1 text-sm text-muted">
            Accepted AI draft. You can still edit site notes and save changes.
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Accepted draft
        </span>
      </div>

      <div className="mt-6">
        <StructuredProposalContent proposal={proposal} />
      </div>
    </SectionCard>
  );
}
