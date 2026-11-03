"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AuthError } from "@/components/auth/auth-shell";
import { BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY } from "@/lib/proposals/booking-confirmation-copy";
import {
  confirmBookingConfirmationWithoutResending,
  confirmBookingConfirmationWithProviderId,
  retryBookingConfirmationEmail,
  type BookingConfirmNotifyState,
} from "@/lib/proposals/booking-confirmation-notify";

const initialState: BookingConfirmNotifyState = {};

function RetryButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

export function BookingConfirmationRecovery({
  proposalId,
  status,
  hasProviderMessageId = false,
  attemptAt = null,
}: {
  proposalId: string;
  status: "needed" | "failed" | "unknown";
  hasProviderMessageId?: boolean;
  attemptAt?: string | null;
}) {
  const router = useRouter();
  const [retryState, retryAction] = useActionState(
    retryBookingConfirmationEmail,
    initialState
  );
  const [confirmState, confirmAction] = useActionState(
    confirmBookingConfirmationWithoutResending,
    initialState
  );
  const [recordState, recordAction] = useActionState(
    confirmBookingConfirmationWithProviderId,
    initialState
  );

  useEffect(() => {
    if (retryState.ok || confirmState.ok || recordState.ok) {
      router.refresh();
    }
  }, [retryState.ok, confirmState.ok, recordState.ok, router]);

  const error = retryState.error || confirmState.error || recordState.error;
  const title =
    status === "unknown"
      ? "Booking confirmation unsettled — review required"
      : status === "needed"
        ? "Booking confirmation not sent yet"
        : "Booking confirmation failed";

  return (
    <div
      id="booking-confirmation-recovery"
      className="qf-job-prep-banner"
      role="status"
    >
      <p className="qf-job-prep-banner-title">{title}</p>
      <p className="qf-job-prep-banner-copy">
        The booking itself is saved. You do not need to accept again.
        {status === "unknown"
          ? ` ${BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY}`
          : " The provider refused or blocked this send, so you can safely retry the confirmation email."}
      </p>
      {status === "unknown" && attemptAt ? (
        <p className="qf-job-prep-banner-copy">
          Attempt recorded at {new Date(attemptAt).toLocaleString()}. Provider
          acceptance is not the same as confirmed delivery to the customer.
        </p>
      ) : null}
      {error ? <AuthError message={error} /> : null}
      <div className="qf-job-prep-recovery-actions">
        {status === "unknown" && hasProviderMessageId ? (
          <form action={confirmAction}>
            <input type="hidden" name="proposalId" value={proposalId} />
            <RetryButton label="Confirm sent without resending" />
          </form>
        ) : null}
        {status === "unknown" && !hasProviderMessageId ? (
          <form action={recordAction} className="qf-job-prep-recovery-form">
            <input type="hidden" name="proposalId" value={proposalId} />
            <label className="qf-job-prep-banner-copy" htmlFor="provider-message-id">
              Provider message id from the email dashboard
            </label>
            <input
              id="provider-message-id"
              name="messageId"
              type="text"
              autoComplete="off"
              className="qf-input"
              placeholder="e.g. re_…"
            />
            <RetryButton label="Record provider id (no resend)" />
          </form>
        ) : null}
        {status === "needed" || status === "failed" ? (
          <form action={retryAction}>
            <input type="hidden" name="proposalId" value={proposalId} />
            <RetryButton label="Retry confirmation email" />
          </form>
        ) : null}
      </div>
    </div>
  );
}
