import type { ReactNode } from "react";
import { Suspense } from "react";
import { WorkspaceScrollDebug } from "@/components/layout/workspace-scroll-end";
import { ProposalLifecycleActions } from "@/components/proposals/proposal-lifecycle-actions";
import { ProposalStatusBadge } from "@/components/proposals/proposal-status-badge";
import { ProposalTimeline } from "@/components/proposals/proposal-timeline";
import { ProposalWorkspaceActions } from "@/components/proposals/proposal-workspace-actions";
import { SendProposalProvider } from "@/components/proposals/send-proposal-provider";
import {
  BulletList,
  MATERIALS_REVIEW_NOTE,
  OPTIONAL_EXTRAS_EMPTY_MESSAGE,
} from "@/components/proposals/structured-proposal-content";
import { SectionCard } from "@/components/ui/section-card";
import type { CalendarProposal } from "@/lib/calendar/calendar-data";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import type { ProposalStatusEventRecord } from "@/lib/proposals/proposal-status-events";
import {
  mapDbRowToStructuredProposal,
} from "@/lib/proposals/structured-proposal";

export type ProposalWorkspaceData = {
  id: string;
  proposal_number: string;
  status: string;
  title: string;
  job_address: string | null;
  rough_notes: string | null;
  customer_name: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string | null;
  attention_reason: string | null;
  booking_confirmation: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  booked_at: string | null;
  completed_at: string | null;
  job_summary: string | null;
  scope_of_work: string | null;
  materials: unknown;
  labour_description: string | null;
  estimated_duration: string | null;
  planned_start_date_text: string | null;
  planned_start_date: string | null;
  things_to_confirm_items: unknown;
  ai_optional_extras: unknown;
  payment_terms: string | null;
};

function WorkspaceCardHeading({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="qf-card-heading-row">
      <span className="qf-card-heading-icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="qf-card-heading">{title}</h2>
    </div>
  );
}

function WorkspaceSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionCard className="qf-card-form">
      <WorkspaceCardHeading title={title} icon={icon} />
      <div className="mt-4 qf-body-text">{children}</div>
    </SectionCard>
  );
}

function EmptySection({ message }: { message: string }) {
  return <p className="text-muted">{message}</p>;
}

function formatLastUpdated(value: string | null, fallback: string): string {
  const dateValue = value ?? fallback;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

const DOC_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);

const USER_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CLOCK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const SPARKLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8H4l4.9 3.6-1.9 5.8L12 14.6l5 3.8-1.9-5.8L20 8.8h-6.1L12 3z" />
  </svg>
);

function CustomerDetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="qf-workspace-detail-row">
      <dt className="qf-workspace-detail-label">{label}</dt>
      <dd className="qf-workspace-detail-value">{value}</dd>
    </div>
  );
}

function ProposalWorkspaceLeft({
  proposal,
  structured,
}: {
  proposal: ProposalWorkspaceData;
  structured: ReturnType<typeof mapDbRowToStructuredProposal>;
}) {
  const hasStructured = Boolean(structured);

  return (
    <div className="qf-proposal-col-left">
      <WorkspaceSection title="Project Summary" icon={DOC_ICON}>
        {hasStructured ? (
          <p>{structured!.jobSummary}</p>
        ) : (
          <EmptySection message="Generate a proposal draft to see the project summary here." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Scope of Work" icon={DOC_ICON}>
        {hasStructured && structured!.scopeOfWork.length > 0 ? (
          <BulletList items={structured!.scopeOfWork} />
        ) : (
          <EmptySection message="Scope of work will appear after you generate and accept an AI draft." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Materials" icon={DOC_ICON}>
        {hasStructured && structured!.materials.length > 0 ? (
          <>
            <BulletList items={structured!.materials} />
            <p className="mt-3 text-xs text-muted">{MATERIALS_REVIEW_NOTE}</p>
          </>
        ) : (
          <EmptySection message="Materials will be listed here once the AI draft is ready." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Optional Extras" icon={DOC_ICON}>
        {hasStructured && structured!.optionalExtras.length > 0 ? (
          <BulletList items={structured!.optionalExtras} />
        ) : (
          <p>{OPTIONAL_EXTRAS_EMPTY_MESSAGE}</p>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Payment Terms" icon={DOC_ICON}>
        {hasStructured && structured!.paymentTerms ? (
          <p className="whitespace-pre-wrap">{structured!.paymentTerms}</p>
        ) : (
          <EmptySection message="Payment terms will be added when you accept an AI draft." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="AI Suggestions" icon={SPARKLE_ICON}>
        {hasStructured && structured!.thingsToConfirm.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Review these items before sending the proposal to your customer.
            </p>
            <BulletList items={structured!.thingsToConfirm} />
          </div>
        ) : proposal.rough_notes ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Generate an AI draft to turn your site notes into structured
              suggestions.
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {proposal.rough_notes}
            </p>
          </div>
        ) : (
          <EmptySection message="AI suggestions will appear after you write site notes and generate a draft." />
        )}
      </WorkspaceSection>
    </div>
  );
}

function ProposalWorkspaceRight({
  proposal,
  statusEvents,
}: {
  proposal: ProposalWorkspaceData;
  statusEvents: ProposalStatusEventRecord[];
}) {
  return (
    <div className="qf-proposal-col-right">
      <SectionCard className="qf-card-form">
        <WorkspaceCardHeading title="Customer Details" icon={USER_ICON} />
        <dl className="mt-4 space-y-4">
          <CustomerDetailRow label="Name" value={proposal.customer_name} />
          <CustomerDetailRow label="Phone" value={proposal.customer_phone} />
          <CustomerDetailRow label="Email" value={proposal.customer_email} />
          <CustomerDetailRow
            label="Property address"
            value={proposal.customer_address ?? proposal.job_address}
          />
        </dl>
      </SectionCard>

      <div id="proposal-timeline">
        <SectionCard className="qf-card-form">
          <WorkspaceCardHeading title="Proposal Timeline" icon={CLOCK_ICON} />
          <div className="mt-4">
            <ProposalTimeline proposal={proposal} statusEvents={statusEvents} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function ProposalWorkspace({
  proposal,
  businessName,
  senderName,
  statusEvents,
  calendarProposals,
}: {
  proposal: ProposalWorkspaceData;
  businessName: string;
  senderName: string;
  statusEvents: ProposalStatusEventRecord[];
  calendarProposals: CalendarProposal[];
}) {
  const structured = mapDbRowToStructuredProposal(proposal);
  const actionContext = {
    status: proposal.status,
    job_summary: proposal.job_summary,
    rough_notes: proposal.rough_notes,
    customer_name: proposal.customer_name,
    customer_email: proposal.customer_email,
    total_amount: proposal.total_amount,
  };
  const devTestingEnabled = isDevTestingEnabled();

  return (
    <SendProposalProvider
      devTestingEnabled={devTestingEnabled}
      data={{
        proposalId: proposal.id,
        proposalNumber: proposal.proposal_number,
        customerName: proposal.customer_name ?? "Customer",
        customerEmail: proposal.customer_email,
        customerId: proposal.customer_id,
        businessName,
        senderName,
      }}
    >
      <div className="qf-proposal-page qf-workspace-page qf-mobile-safe">
      <header className="qf-workspace-header">
        <div className="qf-workspace-header-top">
          <p className="qf-workspace-number">{proposal.proposal_number}</p>
          <ProposalStatusBadge status={proposal.status} />
        </div>

        <h1 className="qf-workspace-customer">
          {proposal.customer_name ?? "Unknown customer"}
        </h1>

        <div className="qf-workspace-meta">
          <div className="qf-workspace-meta-item">
            <span className="qf-workspace-meta-label">Price</span>
            <span className="qf-workspace-meta-value">
              {formatPenceAsGbp(proposal.total_amount)}
            </span>
          </div>
          {proposal.estimated_duration ? (
            <div className="qf-workspace-meta-item">
              <span className="qf-workspace-meta-label">Duration</span>
              <span className="qf-workspace-meta-value">
                {proposal.estimated_duration}
              </span>
            </div>
          ) : null}
          <div className="qf-workspace-meta-item">
            <span className="qf-workspace-meta-label">Last updated</span>
            <span className="qf-workspace-meta-value">
              {formatLastUpdated(proposal.updated_at, proposal.created_at)}
            </span>
          </div>
        </div>
      </header>

      <ProposalWorkspaceActions
        proposalId={proposal.id}
        status={proposal.status}
        actionContext={actionContext}
      />

      <Suspense fallback={null}>
        <ProposalLifecycleActions
          proposalId={proposal.id}
          status={proposal.status}
          bookingConfirmation={proposal.booking_confirmation}
          plannedStartDateText={proposal.planned_start_date_text}
          plannedStartDate={proposal.planned_start_date}
          estimatedDuration={proposal.estimated_duration}
          calendarProposals={calendarProposals}
        />
      </Suspense>

      <div className="qf-workspace-layout">
        <ProposalWorkspaceLeft proposal={proposal} structured={structured} />
        <ProposalWorkspaceRight
          proposal={proposal}
          statusEvents={statusEvents}
        />
      </div>

      <WorkspaceScrollDebug context="proposal-detail" />
    </div>
    </SendProposalProvider>
  );
}
