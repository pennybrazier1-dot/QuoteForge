import type { ReactNode } from "react";
import { Suspense } from "react";
import { WorkspaceScrollDebug } from "@/components/layout/workspace-scroll-end";
import { ConversationResolutionPanel } from "@/components/proposals/conversation-resolution-panel";
import { AttentionConversationSection } from "@/components/proposals/attention-conversation-section";
import {
  AfterAttentionIdle,
  AttentionOnly,
  AttentionVisibilityProvider,
  OptimisticOrServerDateBanner,
} from "@/components/proposals/attention-visibility";
import { CompletedJobActions } from "@/components/jobs/completed-job-actions";
import { CompletedJobPayment } from "@/components/jobs/completed-job-payment";
import { JobPreparationPanel } from "@/components/proposals/job-preparation-panel";
import { ProposalConversationPanel } from "@/components/proposals/proposal-conversation-panel";
import { ProposalLifecycleActions } from "@/components/proposals/proposal-lifecycle-actions";
import { ProposalStatusBadge } from "@/components/proposals/proposal-status-badge";
import { ProposalTimeline } from "@/components/proposals/proposal-timeline";
import { ProposalWorkspaceActions } from "@/components/proposals/proposal-workspace-actions";
import { WorkspaceDisclosure } from "@/components/proposals/workspace-disclosure";
import { SendProposalProvider } from "@/components/proposals/send-proposal-provider";
import { TestMarkAsSentButton } from "@/components/proposals/test-mark-as-sent-button";
import { TestSendSuccessNotice } from "@/components/proposals/test-send-success-notice";
import { DevTestingDebugLine } from "@/components/proposals/dev-testing-debug-line-server";
import {
  BulletList,
  MATERIALS_REVIEW_NOTE,
  OPTIONAL_EXTRAS_EMPTY_MESSAGE,
} from "@/components/proposals/structured-proposal-content";
import { SectionCard } from "@/components/ui/section-card";
import {
  buildCalendarJobs,
  type CalendarProposal,
} from "@/lib/calendar/calendar-data";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";
import type { ProposalJobPrepView } from "@/lib/jobs/load-job-for-proposal";
import { conversationHasProposalChange } from "@/lib/proposals/change-request/classify-conversation-intent";
import { buildConversationResolutionSummary } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import { buildDateWorkflowSnapshot } from "@/lib/proposals/date-workflow";
import { formatSlotLabel } from "@/lib/proposals/revision/conversation-agreements";
import { isConversationReplyable } from "@/lib/proposals/customer-portal/conversation-access";
import { CONVERSATION_HASH_ID } from "@/lib/proposals/customer-portal/conversation-deep-link";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import type { ProposalStatusEventRecord } from "@/lib/proposals/proposal-status-events";
import {
  isCompletedJobStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";
import {
  formatCompletedDateLong,
  JOB_COMPLETED_STATUS_TITLE,
} from "@/lib/jobs/complete-job";
import { WORKSPACE_ACTION_STACK_CLASS } from "@/lib/layout/workspace-action-stack";
import { resolveWorkspaceJobTitle } from "@/lib/proposals/workspace-job-title";
import {
  WAITING_PAGE_STATUS_TITLE,
  isWaitingForCustomerPage,
  shouldShowWaitingDateConfirmedBanner,
  shouldShowWaitingHoldBanner,
  waitingPageStatusSupport,
} from "@/lib/proposals/waiting-page-layout";
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
  linked_customer_email?: string | null;
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
  planned_start_time?: string | null;
  things_to_confirm_items: unknown;
  ai_optional_extras: unknown;
  payment_terms: string | null;
  payment_status?: string | null;
  payment_due_amount?: number | null;
  closed_at?: string | null;
  enabled_payment_methods?: import("@/lib/payments/types").PaymentMethod[];
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
    <div className="qf-proposal-col-left" id="change-request-review-target">
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
          <EmptySection message="Scope of work will appear after you generate and accept a proposal draft." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Materials" icon={DOC_ICON}>
        {hasStructured && structured!.materials.length > 0 ? (
          <>
            <BulletList items={structured!.materials} />
            <p className="mt-3 text-xs text-muted">{MATERIALS_REVIEW_NOTE}</p>
          </>
        ) : (
          <EmptySection message="Materials will be listed here once the proposal draft is ready." />
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
          <EmptySection message="Payment terms will be added when you accept a proposal draft." />
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Things to confirm" icon={SPARKLE_ICON}>
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
              Generate a proposal draft to turn your site notes into structured
              items to confirm.
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {proposal.rough_notes}
            </p>
          </div>
        ) : (
          <EmptySection message="Things to confirm will appear after you write site notes and generate a draft." />
        )}
      </WorkspaceSection>
    </div>
  );
}

function ProposalWorkspaceRight({
  proposal,
  statusEvents,
  customerMessages,
  showConversation = true,
  openConversation = false,
}: {
  proposal: ProposalWorkspaceData;
  statusEvents: ProposalStatusEventRecord[];
  customerMessages: ProposalCustomerMessage[];
  showConversation?: boolean;
  openConversation?: boolean;
}) {
  return (
    <div className="qf-proposal-col-right">
      <SectionCard className="qf-card-form">
        <WorkspaceDisclosure title="Customer details">
          <dl className="space-y-4">
            <CustomerDetailRow label="Name" value={proposal.customer_name} />
            <CustomerDetailRow label="Phone" value={proposal.customer_phone} />
            <CustomerDetailRow label="Email" value={proposal.customer_email} />
            <CustomerDetailRow
              label="Property address"
              value={proposal.customer_address ?? proposal.job_address}
            />
          </dl>
        </WorkspaceDisclosure>
      </SectionCard>

      {showConversation ? (
        <div id={CONVERSATION_HASH_ID}>
          <div id="customer-replies">
          <SectionCard className="qf-card-form">
            <WorkspaceDisclosure title="Conversation" forceOpen={openConversation}>
              <ProposalConversationPanel
                proposalId={proposal.id}
                messages={customerMessages}
                canReply={isConversationReplyable(proposal.status)}
                focusOnMount={openConversation}
                showReviseLink={conversationHasProposalChange(customerMessages)}
              />
            </WorkspaceDisclosure>
          </SectionCard>
          </div>
        </div>
      ) : null}

      <div id="proposal-timeline">
        <SectionCard className="qf-card-form">
          <WorkspaceDisclosure title="Proposal timeline">
            <ProposalTimeline proposal={proposal} statusEvents={statusEvents} />
          </WorkspaceDisclosure>
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
  customerMessages = [],
  jobPrep = null,
  openConversation = false,
}: {
  proposal: ProposalWorkspaceData;
  businessName: string;
  senderName: string;
  statusEvents: ProposalStatusEventRecord[];
  calendarProposals: CalendarProposal[];
  customerMessages?: ProposalCustomerMessage[];
  jobPrep?: ProposalJobPrepView | null;
  openConversation?: boolean;
}) {
  const structured = mapDbRowToStructuredProposal(proposal);
  const devTestingEnabled = isDevTestingEnabled();
  const status = normalizeProposalStatus(proposal.status);
  const hasCustomerMessages = customerMessages.some(
    (message) =>
      message.direction !== "trader" &&
      message.kind !== "trader_reply" &&
      message.body.trim().length > 0
  );
  const proposalAccepted =
    status === "booked" ||
    status === "completed" ||
    Boolean(proposal.accepted_at);
  const dateWorkflow = buildDateWorkflowSnapshot({
    status: proposal.status,
    acceptedAt: proposal.accepted_at,
    bookingConfirmation: proposal.booking_confirmation,
    plannedStartDate: proposal.planned_start_date,
    plannedStartTime: proposal.planned_start_time,
  });
  const confirmedSlotLabel = formatSlotLabel({
    dateIso: proposal.planned_start_date,
    dateText: proposal.planned_start_date_text,
    timeHm: proposal.planned_start_time,
  });
  const shortJobTitle = resolveWorkspaceJobTitle({
    title: proposal.title,
    jobSummary: proposal.job_summary,
    proposalNumber: proposal.proposal_number,
  });
  const builtResolutionSummary =
    status === "needs_attention" && hasCustomerMessages
      ? buildConversationResolutionSummary(customerMessages, new Date(), {
          proposalAccepted,
          dateState: dateWorkflow.dateState,
          persistedDate: proposal.planned_start_date,
          persistedTime: proposal.planned_start_time,
          attentionReason: proposal.attention_reason,
          statusEvents,
          calendarJobs: buildCalendarJobs(calendarProposals),
          proposalId: proposal.id,
          estimatedDuration: proposal.estimated_duration,
        })
      : null;
  const resolutionSummary = builtResolutionSummary?.hasActiveAttention
    ? builtResolutionSummary
    : null;
  const actionContext = {
    status: proposal.status,
    job_summary: proposal.job_summary,
    rough_notes: proposal.rough_notes,
    customer_name: proposal.customer_name,
    customer_email: proposal.customer_email,
    linked_customer_email: proposal.linked_customer_email ?? null,
    total_amount: proposal.total_amount,
  };
  return (
    <SendProposalProvider
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
      <div className="qf-trader-page qf-proposal-page qf-workspace-page qf-mobile-safe">
      <AttentionVisibilityProvider>
      <header className="qf-workspace-header">
        <div className="qf-workspace-header-top">
          <p className="qf-workspace-number">{proposal.proposal_number}</p>
          <ProposalStatusBadge status={proposal.status} />
        </div>

        <h1 className="qf-workspace-customer">
          {proposal.customer_name ?? "Unknown customer"}
        </h1>
        {shortJobTitle ? (
          <p className="qf-workspace-job-title">{shortJobTitle}</p>
        ) : null}

        <OptimisticOrServerDateBanner
          isBookedJob={dateWorkflow.isBookedJob}
          confirmedSlotLabel={confirmedSlotLabel}
        />

        {isCompletedJobStatus(proposal.status) ? (
          <section className="qf-date-state-banner qf-date-state-banner-completed" role="status">
            <p className="qf-date-state-title">{JOB_COMPLETED_STATUS_TITLE}</p>
            <p className="qf-date-state-copy">
              {formatCompletedDateLong(proposal.completed_at)}
            </p>
          </section>
        ) : null}

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

      <div className={WORKSPACE_ACTION_STACK_CLASS}>
      {isWaitingForCustomerPage(proposal.status) ? (
        <section className="qf-waiting-status" role="status">
          <p className="qf-waiting-status-title">{WAITING_PAGE_STATUS_TITLE}</p>
          {waitingPageStatusSupport(proposal.customer_name) ? (
            <p className="qf-waiting-status-copy">
              {waitingPageStatusSupport(proposal.customer_name)}
            </p>
          ) : null}
        </section>
      ) : null}

      {shouldShowWaitingDateConfirmedBanner(proposal.status) &&
      dateWorkflow.waitingForProposalAcceptance &&
      confirmedSlotLabel ? (
        <section className="qf-date-state-banner" role="status">
          <p className="qf-date-state-title">Date confirmed ✓</p>
          <p className="qf-date-state-copy">{confirmedSlotLabel}</p>
          <p className="qf-date-state-note">
            Waiting for customer to accept proposal
          </p>
        </section>
      ) : null}

      {shouldShowWaitingHoldBanner(proposal.status) &&
      dateWorkflow.waitingForDateConfirmation &&
      !dateWorkflow.proposalAccepted &&
      confirmedSlotLabel ? (
        <section className="qf-date-state-banner qf-date-state-banner-hold" role="status">
          <p className="qf-date-state-title">Date held provisionally</p>
          <p className="qf-date-state-copy">{confirmedSlotLabel}</p>
          <p className="qf-date-state-note">
            Waiting for customer to confirm this date
          </p>
        </section>
      ) : null}

      {/* Attention flow: request + resolve → proposal → conversation → lifecycle */}
      {resolutionSummary ? (
        <AttentionOnly>
        <SectionCard className="qf-card-form qf-change-request-card">
          <ConversationResolutionPanel
            proposalId={proposal.id}
            summary={resolutionSummary}
            section="all"
          />
        </SectionCard>
        </AttentionOnly>
      ) : null}
      <AfterAttentionIdle hasAttention={Boolean(resolutionSummary)}>
        <ProposalWorkspaceActions
          proposalId={proposal.id}
          status={proposal.status}
          actionContext={actionContext}
        />
      </AfterAttentionIdle>

      <DevTestingDebugLine />

      <TestMarkAsSentButton
        proposalId={proposal.id}
        status={proposal.status}
        customerEmail={proposal.customer_email}
        devTestingEnabled={devTestingEnabled}
      />

      <Suspense fallback={null}>
        <TestSendSuccessNotice proposalId={proposal.id} />
      </Suspense>

      <AfterAttentionIdle hasAttention={Boolean(resolutionSummary)}>
        <Suspense fallback={null}>
          <ProposalLifecycleActions
            proposalId={proposal.id}
            status={proposal.status}
            bookingConfirmation={proposal.booking_confirmation}
            plannedStartDateText={proposal.planned_start_date_text}
            plannedStartDate={proposal.planned_start_date}
            plannedStartTime={proposal.planned_start_time}
            estimatedDuration={proposal.estimated_duration}
            customerName={proposal.customer_name}
            proposalTotalLabel={formatPenceAsGbp(proposal.total_amount)}
            sentAt={proposal.sent_at}
            calendarProposals={calendarProposals}
            devTestingEnabled={devTestingEnabled}
          />
        </Suspense>
        {normalizeProposalStatus(proposal.status) === "completed" ? (
          <>
            <CompletedJobPayment
              proposalId={proposal.id}
              jobStatus={proposal.status}
              customerName={proposal.customer_name}
              jobTitle={shortJobTitle || proposal.title}
              proposalTotal={proposal.total_amount}
              paymentStatus={proposal.payment_status ?? "not_requested"}
              paymentDueAmount={proposal.payment_due_amount ?? null}
              closedAt={proposal.closed_at ?? null}
              enabledMethods={proposal.enabled_payment_methods ?? []}
            />
            <CompletedJobActions proposalId={proposal.id} />
          </>
        ) : null}
      </AfterAttentionIdle>
      </div>

      {jobPrep ? (
        <div id="job-preparation">
          <SectionCard className="qf-card-form qf-job-prep-card">
            <JobPreparationPanel view={jobPrep} />
          </SectionCard>
        </div>
      ) : null}

      <AttentionOnly>
      {resolutionSummary ? (
        <div className="qf-attention-desktop-block">
          <h2 className="qf-resolution-current-title">Current proposal</h2>
          <div className="qf-workspace-layout">
            <ProposalWorkspaceLeft proposal={proposal} structured={structured} />
            <ProposalWorkspaceRight
              proposal={proposal}
              statusEvents={statusEvents}
              customerMessages={customerMessages}
              showConversation={false}
              openConversation={openConversation}
            />
          </div>
        </div>
      ) : null}
      </AttentionOnly>
      <AfterAttentionIdle hasAttention={Boolean(resolutionSummary)}>
        <div className="qf-workspace-layout">
          <ProposalWorkspaceLeft proposal={proposal} structured={structured} />
          <ProposalWorkspaceRight
            proposal={proposal}
            statusEvents={statusEvents}
            customerMessages={customerMessages}
            showConversation
            openConversation={openConversation}
          />
        </div>
      </AfterAttentionIdle>

      {resolutionSummary ? (
        <AttentionOnly>
          <AttentionConversationSection
            proposalId={proposal.id}
            messages={customerMessages}
            headingIcon={USER_ICON}
            openConversation={openConversation}
            hideReplyUntilRequested={
              !openConversation &&
              (resolutionSummary.resolutionFocus === "date_agreed" ||
                resolutionSummary.resolutionFocus === "date_discussed")
            }
          />

          <section
            className="qf-resolution-final-actions"
            aria-label="Proposal actions"
          >
            <h2 className="qf-resolution-final-title">Proposal actions</h2>
            <p className="qf-resolution-final-copy">
              Send an updated proposal or use other controls when you are ready.
            </p>
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
                plannedStartTime={proposal.planned_start_time}
                estimatedDuration={proposal.estimated_duration}
                customerName={proposal.customer_name}
                proposalTotalLabel={formatPenceAsGbp(proposal.total_amount)}
                sentAt={proposal.sent_at}
                calendarProposals={calendarProposals}
                devTestingEnabled={devTestingEnabled}
              />
            </Suspense>
          </section>
        </AttentionOnly>
      ) : null}

      <WorkspaceScrollDebug context="proposal-detail" />
      </AttentionVisibilityProvider>
    </div>
    </SendProposalProvider>
  );
}
