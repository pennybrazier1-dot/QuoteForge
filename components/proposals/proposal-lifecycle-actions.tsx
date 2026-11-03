"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  recordCustomerDecline,
  type CustomerResponseState,
} from "@/app/proposals/customer-response-actions";
import {
  markJobComplete,
  type LifecycleActionState,
} from "@/app/proposals/lifecycle-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { BookingDialog } from "@/components/proposals/booking-dialog";
import { DevLifecycleTools } from "@/components/proposals/dev-lifecycle-tools";
import { buildDateWorkflowSnapshot } from "@/lib/proposals/date-workflow";
import type { CalendarProposal } from "@/lib/calendar/calendar-data";
import {
  isProposalStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";
import {
  confirmIssueWithoutResending,
  issueRevisedProposalByEmail,
  simulateIssueRevisedProposal,
  type IssueRevisedProposalState,
} from "@/lib/proposals/revision/issue-revised-proposal";

const responseInitialState: CustomerResponseState = {};
const lifecycleInitialState: LifecycleActionState = {};
const issueInitialState: IssueRevisedProposalState = {};

function ActionButton({
  label,
  pendingLabel,
  variant = "secondary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const className =
    variant === "primary"
      ? "qf-btn-primary"
      : variant === "danger"
        ? "qf-btn-danger"
        : "qf-btn-secondary";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

type ProposalLifecycleActionsProps = {
  proposalId: string;
  status: string;
  bookingConfirmation: string | null;
  plannedStartDateText: string | null;
  plannedStartDate: string | null;
  plannedStartTime?: string | null;
  estimatedDuration: string | null;
  customerName?: string | null;
  proposalTotalLabel?: string | null;
  sentAt?: string | null;
  calendarProposals: CalendarProposal[];
  devTestingEnabled: boolean;
  contentRevision?: number;
  unsentRevisionAt?: string | null;
  issuedContentRevision?: number | null;
  issueAttemptAt?: string | null;
  issueAttemptMessageId?: string | null;
};

export function ProposalLifecycleActions({
  proposalId,
  status,
  bookingConfirmation,
  plannedStartDateText,
  plannedStartDate,
  estimatedDuration,
  proposalTotalLabel,
  calendarProposals,
  devTestingEnabled,
  contentRevision = 0,
  unsentRevisionAt = null,
  issuedContentRevision = null,
  issueAttemptAt = null,
  issueAttemptMessageId = null,
}: ProposalLifecycleActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [declineState, declineAction] = useActionState(
    recordCustomerDecline,
    responseInitialState
  );
  const [lifecycleState, lifecycleAction] = useActionState(
    markJobComplete,
    lifecycleInitialState
  );
  const [issueState, issueAction] = useActionState(
    simulateIssueRevisedProposal,
    issueInitialState
  );
  const [emailIssueState, emailIssueAction] = useActionState(
    issueRevisedProposalByEmail,
    issueInitialState
  );
  const [confirmIssueState, confirmIssueAction] = useActionState(
    confirmIssueWithoutResending,
    issueInitialState
  );
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState<{
    text: string | null;
    exact: string | null;
  }>({ text: null, exact: null });
  const normalized = normalizeProposalStatus(status);

  const confirmBookingFromUrl = searchParams.get("confirmBooking") === "1";
  const plannedStartHint = searchParams.get("plannedStartHint");
  const plannedStartExactHint = searchParams.get("plannedStartExact");
  const [handledConfirmUrl, setHandledConfirmUrl] = useState(false);

  if (confirmBookingFromUrl && !handledConfirmUrl) {
    setHandledConfirmUrl(true);
    setConfirmDialogOpen(true);
    setBookingPrefill({
      text: plannedStartHint,
      exact: plannedStartExactHint,
    });
  }

  useEffect(() => {
    if (confirmBookingFromUrl) {
      router.replace(`/proposals/${proposalId}`, { scroll: false });
    }
  }, [confirmBookingFromUrl, proposalId, router]);

  if (!isProposalStatus(normalized)) {
    return null;
  }

  const dateWorkflow = buildDateWorkflowSnapshot({
    status: normalized,
    bookingConfirmation,
    plannedStartDate,
  });
  const waitingStatus = normalized === "waiting_for_customer";
  const showAttention = normalized === "needs_attention";
  const hasUnsentRevision = Boolean(unsentRevisionAt);
  const showIssueRevised = showAttention && hasUnsentRevision;
  const showIssueAttemptRecovery =
    showIssueRevised && Boolean(issueAttemptAt && issueAttemptMessageId);
  const showGenericAttentionSend = showAttention && !hasUnsentRevision;
  const showNeedsSchedule = dateWorkflow.needsScheduleJob;
  const showConfirmedBooked = dateWorkflow.isBookedJob;

  if (
    !waitingStatus &&
    !showAttention &&
    !showNeedsSchedule &&
    !showConfirmedBooked
  ) {
    return null;
  }

  const error = declineState.error || lifecycleState.error;

  if (
    waitingStatus &&
    !showAttention &&
    !showNeedsSchedule &&
    !showConfirmedBooked &&
    !error &&
    !devTestingEnabled
  ) {
    return null;
  }

  return (
    <section
      className="qf-workspace-lifecycle"
      aria-label="Job lifecycle"
      id="proposal-lifecycle"
    >
      {error ? <AuthError message={error} /> : null}
      {issueState.ok || emailIssueState.ok || confirmIssueState.ok ? (
        <p className="qf-workspace-actions-success" role="status">
          Revised proposal issued
          {issueState.simulated || emailIssueState.simulated
            ? " (test simulation — provider accepted locally, not confirmed customer delivery)"
            : " (email provider accepted — not confirmed customer delivery)"}
          . The customer can now review and accept this revision.
        </p>
      ) : null}
      {issueState.error || emailIssueState.error || confirmIssueState.error ? (
        <AuthError
          message={
            issueState.error ||
            emailIssueState.error ||
            confirmIssueState.error ||
            ""
          }
        />
      ) : null}

      {waitingStatus ? (
        <DevLifecycleTools
          proposalId={proposalId}
          status={status}
          devTestingEnabled={devTestingEnabled}
        />
      ) : null}

      {showIssueRevised ? (
        <div className="qf-workspace-lifecycle-block">
          <p className="qf-workspace-lifecycle-label">Issue revised proposal</p>
          <p className="qf-workspace-lifecycle-copy">
            Saved revision {contentRevision}
            {proposalTotalLabel ? ` · revised total ${proposalTotalLabel}` : null}
            . Save and Issue are separate. After a successful issue, the customer
            can accept this exact revision only.
            {issuedContentRevision != null
              ? ` Last issued revision: ${issuedContentRevision}.`
              : null}
          </p>
          {showIssueAttemptRecovery ? (
            <div className="qf-issue-attempt-banner" role="status">
              <strong>Issue may be incomplete</strong>
              The email provider accepted a send, but Reanvil still shows this
              revision as unsent. Do not send again yet. Confirm the issue below
              to clear the lock without another email.
              <form action={confirmIssueAction} className="mt-3">
                <input type="hidden" name="proposalId" value={proposalId} />
                <input
                  type="hidden"
                  name="expectedContentRevision"
                  value={String(contentRevision)}
                />
                <ActionButton
                  label="Confirm issue without resending"
                  pendingLabel="Confirming…"
                  variant="primary"
                />
              </form>
            </div>
          ) : null}
          <div className="qf-workspace-lifecycle-actions">
            {devTestingEnabled ? (
              <form action={issueAction} className="w-full">
                <input type="hidden" name="proposalId" value={proposalId} />
                <input
                  type="hidden"
                  name="expectedContentRevision"
                  value={String(contentRevision)}
                />
                <ActionButton
                  label="Test: Issue revised proposal"
                  pendingLabel="Issuing…"
                  variant="primary"
                />
              </form>
            ) : (
              <form action={emailIssueAction} className="w-full">
                <input type="hidden" name="proposalId" value={proposalId} />
                <input
                  type="hidden"
                  name="expectedContentRevision"
                  value={String(contentRevision)}
                />
                <ActionButton
                  label="Issue revised proposal"
                  pendingLabel="Issuing…"
                  variant="primary"
                />
              </form>
            )}
            <a
              href={`/proposals/${proposalId}/revise`}
              className="qf-btn-secondary"
            >
              Edit revision
            </a>
            <form action={declineAction} className="w-full">
              <input type="hidden" name="proposalId" value={proposalId} />
              <ActionButton
                label="Cancel job"
                pendingLabel="Cancelling…"
                variant="danger"
              />
            </form>
          </div>
        </div>
      ) : null}

      {showGenericAttentionSend ? (
        <div className="qf-workspace-lifecycle-block">
          <p className="qf-workspace-lifecycle-label">Your response</p>
          <p className="qf-workspace-lifecycle-copy">
            To change the quote, save a revision first. Generic “updated”
            sends without a saved revision are blocked.
          </p>
          <div className="qf-workspace-lifecycle-actions">
            <a
              href={`/proposals/${proposalId}/revise`}
              className="qf-btn-primary"
            >
              Update proposal
            </a>
            <form action={declineAction} className="w-full">
              <input type="hidden" name="proposalId" value={proposalId} />
              <ActionButton
                label="Cancel job"
                pendingLabel="Cancelling…"
                variant="danger"
              />
            </form>
          </div>
        </div>
      ) : null}

      {showNeedsSchedule ? (
        <div className="qf-workspace-lifecycle-block">
          <p className="qf-workspace-lifecycle-label">
            {dateWorkflow.waitingForDateConfirmation
              ? "Waiting for customer to confirm the date"
              : "Proposal accepted — schedule the actual job when preparation is ready"}
          </p>
          {dateWorkflow.waitingForDateConfirmation ? null : (
            <div className="qf-workspace-lifecycle-actions">
              <a
                href={`/proposals/${proposalId}/schedule`}
                className="qf-btn-primary"
              >
                Schedule job
              </a>
            </div>
          )}
        </div>
      ) : null}

      {showConfirmedBooked ? (
        <div className="qf-workspace-lifecycle-block">
          <div className="qf-workspace-lifecycle-actions">
            <form action={lifecycleAction} className="w-full">
              <input type="hidden" name="proposalId" value={proposalId} />
              <ActionButton
                label="Mark complete"
                pendingLabel="Completing…"
                variant="primary"
              />
            </form>
          </div>
        </div>
      ) : null}

      <BookingDialog
        mode="confirm"
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setBookingPrefill({ text: null, exact: null });
        }}
        proposalId={proposalId}
        plannedStartDateText={plannedStartDateText}
        plannedStartDate={plannedStartDate}
        estimatedDuration={estimatedDuration}
        bookingConfirmation="confirmed"
        calendarProposals={calendarProposals}
        prefillPlannedStartText={bookingPrefill.text}
        prefillPlannedStartExact={bookingPrefill.exact}
      />
    </section>
  );
}
