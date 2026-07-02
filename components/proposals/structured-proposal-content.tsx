import type { ReactNode } from "react";
import type { StructuredProposalData } from "@/lib/proposals/structured-proposal";
import { SectionCard } from "@/components/ui/section-card";

export const OPTIONAL_EXTRAS_EMPTY_MESSAGE =
  "No optional extras have been identified from the information provided.";

export const MATERIALS_REVIEW_NOTE =
  "Materials listed are based on the information provided and should be reviewed before the proposal is sent.";

export function ProposalSectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SectionCard as="div" variant="inset">
      <h4 className="text-sm font-semibold text-accent">{title}</h4>
      <div className="mt-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </SectionCard>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function StructuredProposalContent({
  proposal,
}: {
  proposal: StructuredProposalData;
}) {
  return (
    <div className="space-y-4">
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

      {proposal.plannedStartDate.trim() ? (
        <ProposalSectionBlock title="Planned Start Date">
          <p>{proposal.plannedStartDate}</p>
        </ProposalSectionBlock>
      ) : null}

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
  );
}
