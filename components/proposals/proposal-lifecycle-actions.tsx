"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  recordCustomerAttention,
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
import { ATTENTION_REASONS, formatAttentionReason } from "@/lib/proposals/attention";
import { isProvisionalBooking } from "@/lib/proposals/booking";
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
};

export function ProposalLifecycleActions({
  proposalId,
  status,
  bookingConfirmation,
  plannedStartDateText,
  plannedStartDate,
  estimatedDuration,
}: ProposalLifecycleActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [responseState, responseAction] = useActionState(
    recordCustomerAttention,
    responseInitialState
  );
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
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const normalized = normalizeProposalStatus(status);

  useEffect(() => {
    if (searchParams.get("confirmBooking") === "1") {
      setConfirmDialogOpen(true);
      router.replace(`/proposals/${proposalId}`, { scroll: false });
    }
  }, [proposalId, router, searchParams]);

  if (!isProposalStatus(normalized)) {
    return null;
  }

  const showWaiting = normalized === "waiting_for_customer";
  const showAttention = normalized === "needs_attention";
  const showProvisional = isProvisionalBooking(normalized, bookingConfirmation);
  const showConfirmedBooked =
    normalized === "booked" && bookingConfirmation === "confirmed";

  if (!showWaiting && !showAttention && !showProvisional && !showConfirmedBooked) {
    return null;
  }

  const error =
    responseState.error ||
    declineState.error ||
    lifecycleState.error ||
    resendState.error;

  return (
    <section
      className="qf-workspace-lifecycle"
      aria-label="Job lifecycle"
      id="proposal-lifecycle"
    >
      {error ? <AuthError message={error} /> : null}

      {showWaiting ? (
        <div className="qf-workspace-lifecycle-block">
          <p className="qf-workspace-lifecycle-label">Customer response</p>
          <div className="qf-workspace-lifecycle-actions">
            <button
              type="button"
              className="qf-btn-primary"
              onClick={() => setAcceptDialogOpen(true)}
            >
              Mark accepted
            </button>
            {ATTENTION_REASONS.map((reason) => (
              <form key={reason} action={responseAction} className="w-full">
                <input type="hidden" name="proposalId" value={proposalId} />
                <input type="hidden" name="attentionReason" value={reason} />
                <ActionButton
                  label={formatAttentionReason(reason)}
                  pendingLabel="Saving…"
                />
              </form>
            ))}
            <form action={declineAction} className="w-full">
              <input type="hidden" name="proposalId" value={proposalId} />
              <ActionButton
                label="Customer declined"
                pendingLabel="Cancelling…"
                variant="danger"
              />
            </form>
          </div>
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

      {showProvisional ? (
        <div className="qf-workspace-lifecycle-block">
          <p className="qf-workspace-lifecycle-label">
            Provisional booking — confirm the start date, duration, and status
          </p>
          <div className="qf-workspace-lifecycle-actions">
            <button
              type="button"
              className="qf-btn-primary"
              onClick={() => setConfirmDialogOpen(true)}
            >
              Confirm booking
            </button>
          </div>
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
        mode="accept"
        open={acceptDialogOpen}
        onClose={() => setAcceptDialogOpen(false)}
        proposalId={proposalId}
        plannedStartDateText={plannedStartDateText}
        plannedStartDate={plannedStartDate}
        estimatedDuration={estimatedDuration}
      />

      <BookingDialog
        mode="confirm"
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        proposalId={proposalId}
        plannedStartDateText={plannedStartDateText}
        plannedStartDate={plannedStartDate}
        estimatedDuration={estimatedDuration}
        bookingConfirmation="confirmed"
      />
    </section>
  );
}
