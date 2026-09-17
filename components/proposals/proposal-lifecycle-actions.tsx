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
  resendToCustomer,
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

const responseInitialState: CustomerResponseState = {};
const lifecycleInitialState: LifecycleActionState = {};

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
  estimatedDuration: string | null;
  calendarProposals: CalendarProposal[];
  devTestingEnabled: boolean;
};

export function ProposalLifecycleActions({
  proposalId,
  status,
  bookingConfirmation,
  plannedStartDateText,
  plannedStartDate,
  estimatedDuration,
  calendarProposals,
  devTestingEnabled,
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
  const [resendState, resendAction] = useActionState(
    resendToCustomer,
    lifecycleInitialState
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
  const showWaiting = normalized === "waiting_for_customer";
  const showAttention = normalized === "needs_attention";
  const showNeedsSchedule = dateWorkflow.needsScheduleJob;
  const showConfirmedBooked = dateWorkflow.isBookedJob;

  if (!showWaiting && !showAttention && !showNeedsSchedule && !showConfirmedBooked) {
    return null;
  }

  const error =
    declineState.error || lifecycleState.error || resendState.error;

  return (
    <section
      className="qf-workspace-lifecycle"
      aria-label="Job lifecycle"
      id="proposal-lifecycle"
    >
      {error ? <AuthError message={error} /> : null}

      {showWaiting ? (
        <div className="qf-workspace-lifecycle-block">
          <DevLifecycleTools
            proposalId={proposalId}
            status={status}
            devTestingEnabled={devTestingEnabled}
          />
          <p className="qf-workspace-lifecycle-label">Waiting for customer</p>
          <p className="qf-workspace-lifecycle-copy">
            The customer chooses what happens next from their proposal link:
            Accept, Ask a question, Request a change, or Decline.
          </p>
        </div>
      ) : null}

      {showAttention ? (
        <div className="qf-workspace-lifecycle-block">
          <p className="qf-workspace-lifecycle-label">Your response</p>
          <div className="qf-workspace-lifecycle-actions">
            <form action={resendAction} className="w-full">
              <input type="hidden" name="proposalId" value={proposalId} />
              <ActionButton
                label="Send updated quote"
                pendingLabel="Updating…"
                variant="primary"
              />
            </form>
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
