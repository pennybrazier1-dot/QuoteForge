import type { ReactNode } from "react";
import type { GeneratedProposal } from "@/lib/ai";

const OPTIONAL_EXTRAS_EMPTY_MESSAGE =
  "No optional extras have been identified from the information provided.";

const MATERIALS_REVIEW_NOTE =
  "Materials listed are based on the information provided and should be reviewed before the proposal is sent.";

function ProposalSectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-background p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-accent">{title}</h4>
      <div className="mt-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function GeneratedProposalPreview({
  proposal,
}: {
  proposal: GeneratedProposal;
}) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Generated proposal draft</h3>
          <p className="mt-1 text-sm text-muted">
            Review carefully before saving. This draft is not saved yet.
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          AI draft
        </span>
      </div>

      <div className="mt-6 space-y-4">
        <ProposalSectionBlock title="Job Summary">
          <p>{proposal.jobSummary}</p>
        </ProposalSectionBlock>

        <ProposalSectionBlock title="Scope of Work">
          {proposal.scopeOfWork.length > 0 ? (
            <BulletList items={proposal.scopeOfWork} />
          ) : (
            <p className="text-muted">None listed.</p>
          )}
        </ProposalSectionBlock>

        <ProposalSectionBlock title="Materials">
          {proposal.materials.length > 0 ? (
            <BulletList items={proposal.materials} />
          ) : (
            <p className="text-muted">None listed.</p>
          )}
          <p className="mt-3 text-xs text-muted">{MATERIALS_REVIEW_NOTE}</p>
        </ProposalSectionBlock>

        <ProposalSectionBlock title="Labour">
          <p className="whitespace-pre-wrap">{proposal.labour}</p>
        </ProposalSectionBlock>

        <ProposalSectionBlock title="Estimated Duration">
          <p>{proposal.estimatedDuration}</p>
        </ProposalSectionBlock>

        <ProposalSectionBlock title="Things to Confirm">
          {proposal.thingsToConfirm.length > 0 ? (
            <BulletList items={proposal.thingsToConfirm} />
          ) : (
            <p className="text-muted">None listed.</p>
          )}
        </ProposalSectionBlock>

        <ProposalSectionBlock title="Optional Extras">
          {proposal.optionalExtras.length > 0 ? (
            <BulletList items={proposal.optionalExtras} />
          ) : (
            <p>{OPTIONAL_EXTRAS_EMPTY_MESSAGE}</p>
          )}
        </ProposalSectionBlock>

        <ProposalSectionBlock title="Payment Terms">
          <p className="whitespace-pre-wrap">{proposal.paymentTerms}</p>
        </ProposalSectionBlock>
      </div>
    </div>
  );
}
