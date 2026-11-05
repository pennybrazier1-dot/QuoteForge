"use client";

/**
 * Payment-only outbound recovery UI (Stage 9L.4 Part 2Z).
 * Shows honest provider status; Retry only for needed/failed.
 */

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AuthError } from "@/components/auth/auth-shell";
import {
  confirmOutboundWithoutResendAction,
  recordOutboundProviderIdAction,
  reconcileMissingPaymentOutboundForProposalAction,
  retryOutboundMessageAction,
  type OutboundRecoveryActionState,
} from "@/lib/outbound/actions";
import {
  OUTBOUND_UNKNOWN_REVIEW_COPY,
  type OutboundStatus,
} from "@/lib/outbound/types";
import { formatOutboundAttemptAtUtc } from "@/lib/outbound/format-attempt-at";
import {
  outboundStatusDetail,
  outboundStatusLabel,
} from "@/lib/outbound/status-labels";
import type { OutboundEventKind } from "@/lib/outbound/types";

const initialState: OutboundRecoveryActionState = {};

function ActionButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

function paymentEventTitle(eventKind: string | null | undefined): string {
  if (eventKind === "payment_received") return "Payment received email";
  if (eventKind === "payment_requested") return "Payment request email";
  return "Payment email";
}

export function OutboundRecovery({
  outboundMessageId,
  status,
  eventKind = null,
  hasProviderMessageId = false,
  attemptAt = null,
  recipientDisplay,
  lastErrorSafe = null,
}: {
  outboundMessageId: string;
  status: OutboundStatus;
  eventKind?: OutboundEventKind | string | null;
  hasProviderMessageId?: boolean;
  attemptAt?: string | null;
  recipientDisplay?: string | null;
  lastErrorSafe?: string | null;
}) {
  const router = useRouter();
  const [retryState, retryAction] = useActionState(
    retryOutboundMessageAction,
    initialState
  );
  const [confirmState, confirmAction] = useActionState(
    confirmOutboundWithoutResendAction,
    initialState
  );
  const [recordState, recordAction] = useActionState(
    recordOutboundProviderIdAction,
    initialState
  );

  useEffect(() => {
    if (retryState.ok || confirmState.ok || recordState.ok) {
      router.refresh();
    }
  }, [retryState.ok, confirmState.ok, recordState.ok, router]);

  const error = retryState.error || confirmState.error || recordState.error;
  const kindLabel = paymentEventTitle(eventKind);
  const title = `${kindLabel} — ${outboundStatusLabel(status)}`;
  const detail = outboundStatusDetail(status);
  const canRetry = status === "needed" || status === "failed";
  const isTerminal = status === "provider_accepted" || status === "simulated";
  const isUnknown = status === "unknown";
  const isSending = status === "sending";

  return (
    <div
      id={`outbound-recovery-${outboundMessageId}`}
      className="qf-job-prep-banner"
      role="status"
    >
      <p className="qf-job-prep-banner-title">{title}</p>
      <p className="qf-job-prep-banner-copy">{detail}</p>
      {recipientDisplay ? (
        <p className="qf-job-prep-banner-copy">To: {recipientDisplay}</p>
      ) : null}
      {lastErrorSafe ? (
        <p className="qf-job-prep-banner-copy">{lastErrorSafe}</p>
      ) : null}
      {isUnknown ? (
        <p className="qf-job-prep-banner-copy">{OUTBOUND_UNKNOWN_REVIEW_COPY}</p>
      ) : null}
      {attemptAt ? (
        <p className="qf-job-prep-banner-copy">
          Attempt recorded at {formatOutboundAttemptAtUtc(attemptAt)} UTC.
        </p>
      ) : null}
      {error ? <AuthError message={error} /> : null}
      <div className="qf-job-prep-recovery-actions">
        {isUnknown && hasProviderMessageId ? (
          <form action={confirmAction}>
            <input
              type="hidden"
              name="outboundMessageId"
              value={outboundMessageId}
            />
            <ActionButton label="Confirm sent without resending" />
          </form>
        ) : null}
        {isUnknown && !hasProviderMessageId ? (
          <form action={recordAction} className="qf-job-prep-recovery-form">
            <input
              type="hidden"
              name="outboundMessageId"
              value={outboundMessageId}
            />
            <label
              className="qf-job-prep-banner-copy"
              htmlFor={`outbound-provider-id-${outboundMessageId}`}
            >
              Provider message id from the email dashboard
            </label>
            <input
              id={`outbound-provider-id-${outboundMessageId}`}
              name="messageId"
              type="text"
              autoComplete="off"
              className="qf-input"
              placeholder="e.g. re_…"
            />
            <ActionButton label="Record provider id (no resend)" />
          </form>
        ) : null}
        {canRetry ? (
          <form action={retryAction}>
            <input
              type="hidden"
              name="outboundMessageId"
              value={outboundMessageId}
            />
            <ActionButton label="Retry email" />
          </form>
        ) : null}
        {isSending ? (
          <p className="qf-job-prep-banner-copy">
            Wait a moment, then refresh. If this stays stuck, it will become
            unsettled for manual review.
          </p>
        ) : null}
        {isTerminal ? (
          <p className="qf-job-prep-banner-copy">
            No retry is available for this status.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Explicit missing-event reconciliation — never runs on page view alone.
 */
export function MissingPaymentOutboundReconcile({
  proposalId,
  missingRequest,
  missingReceivedCount,
}: {
  proposalId: string;
  missingRequest: boolean;
  missingReceivedCount: number;
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    reconcileMissingPaymentOutboundForProposalAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  if (!missingRequest && missingReceivedCount <= 0) {
    return null;
  }

  const bits: string[] = [];
  if (missingRequest) {
    bits.push("the current payment-request email");
  }
  if (missingReceivedCount > 0) {
    bits.push(
      missingReceivedCount === 1
        ? "1 payment-received email"
        : `${missingReceivedCount} payment-received emails`
    );
  }

  return (
    <div
      id="payment-outbound-missing-reconcile"
      className="qf-job-prep-banner"
      role="status"
    >
      <p className="qf-job-prep-banner-title">Missing payment email</p>
      <p className="qf-job-prep-banner-copy">
        Reanvil saved the payment record but has no outbound row yet for{" "}
        {bits.join(" and ")}. Reconciliation uses the persisted payment
        identity only — it does not invent a new request id or record another
        payment.
      </p>
      {missingRequest ? (
        <p className="qf-job-prep-banner-copy">
          Only the current payment-request event can be reconciled. Earlier
          replaced request identities are not recovered from the proposal
          column.
        </p>
      ) : null}
      {state.error ? <AuthError message={state.error} /> : null}
      {state.ok && (state.attempted ?? 0) > 0 ? (
        <p className="qf-job-prep-banner-copy">
          Reconcile finished — {state.recovered ?? 0} of {state.attempted}{" "}
          attempted.
        </p>
      ) : null}
      {state.ok && (state.attempted ?? 0) === 0 ? (
        <p className="qf-job-prep-banner-copy">
          Nothing missing to reconcile right now.
        </p>
      ) : null}
      <div className="qf-job-prep-recovery-actions">
        <form action={action}>
          <input type="hidden" name="proposalId" value={proposalId} />
          <ActionButton label="Reconcile missing payment emails" />
        </form>
      </div>
    </div>
  );
}
