"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import {
  closeJobAction,
  markJobPaidAction,
  requestJobPaymentAction,
  waiveJobPaymentAction,
  type PaymentActionState,
} from "@/lib/payments/actions";
import {
  canCloseJob,
  canMarkPaymentPaid,
  canRequestPayment,
  canWaivePayment,
  CLOSE_JOB_BLOCKED_COPY,
  defaultPaymentDueAmount,
  formatPaymentStatus,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/job-payment";
import type { PaymentMethod } from "@/lib/payments/types";
import { formatPenceAsGbp } from "@/lib/proposals/money";

const initialState: PaymentActionState = {};

function PendingButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={variant === "primary" ? "qf-btn-primary" : "qf-btn-secondary"}
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CompletedJobPayment({
  proposalId,
  jobStatus,
  customerName,
  jobTitle,
  proposalTotal,
  paymentStatus,
  paymentDueAmount,
  closedAt,
  enabledMethods,
}: {
  proposalId: string;
  jobStatus: string;
  customerName: string | null;
  jobTitle: string;
  proposalTotal: number;
  paymentStatus: string | null;
  paymentDueAmount: number | null;
  closedAt: string | null;
  enabledMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const [requestOpen, setRequestOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [requestState, requestAction] = useActionState(
    requestJobPaymentAction,
    initialState
  );
  const [paidState, paidAction] = useActionState(markJobPaidAction, initialState);
  const [waiveState, waiveAction] = useActionState(
    waiveJobPaymentAction,
    initialState
  );
  const [closeState, closeAction] = useActionState(closeJobAction, initialState);

  const showRequest = canRequestPayment({
    jobStatus,
    paymentStatus,
    closedAt,
  });
  const showPaid = canMarkPaymentPaid({ jobStatus, paymentStatus, closedAt });
  const showWaive = canWaivePayment({ jobStatus, paymentStatus, closedAt });
  const showClose = canCloseJob({ jobStatus, paymentStatus, closedAt });
  const defaultPounds = (
    defaultPaymentDueAmount(paymentDueAmount ?? proposalTotal) / 100
  ).toFixed(2);

  useEffect(() => {
    if (
      requestState.success ||
      paidState.success ||
      waiveState.success ||
      closeState.success
    ) {
      router.refresh();
    }
  }, [
    requestState.success,
    paidState.success,
    waiveState.success,
    closeState.success,
    router,
  ]);

  const error =
    requestState.error ||
    paidState.error ||
    waiveState.error ||
    closeState.error;
  const warning =
    requestState.warning || paidState.warning || closeState.warning;

  return (
    <section className="qf-workspace-lifecycle" aria-label="Payment">
      <div className="qf-workspace-lifecycle-block">
        <p className="qf-workspace-lifecycle-label">Work completed</p>
        <p className="qf-payment-status-line">
          Payment status: {formatPaymentStatus(paymentStatus)}
        </p>
        {paymentDueAmount != null && paymentStatus !== "not_requested" ? (
          <p className="qf-payment-status-line">
            Amount due: {formatPenceAsGbp(paymentDueAmount)}
          </p>
        ) : null}
        {error ? <AuthError message={error} /> : null}
        {warning ? (
          <p className="qf-workspace-actions-success" role="status">
            {warning}
          </p>
        ) : null}
        <div className="qf-workspace-lifecycle-actions">
          {showRequest ? (
            <button
              type="button"
              className="qf-btn-primary"
              onClick={() => setRequestOpen(true)}
            >
              Request payment
            </button>
          ) : null}
          {showPaid ? (
            <button
              type="button"
              className="qf-btn-primary"
              onClick={() => setPaidOpen(true)}
            >
              Mark as paid
            </button>
          ) : null}
          {showWaive ? (
            <form action={waiveAction}>
              <input type="hidden" name="proposalId" value={proposalId} />
              <PendingButton
                label="No payment required"
                pendingLabel="Saving…"
                variant="secondary"
              />
            </form>
          ) : null}
          {showClose ? (
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setCloseOpen(true)}
            >
              Close job
            </button>
          ) : paymentStatus !== "paid" &&
            paymentStatus !== "waived" &&
            !closedAt ? (
            <p className="qf-payment-status-hint">{CLOSE_JOB_BLOCKED_COPY}</p>
          ) : null}
        </div>
      </div>

      {requestOpen && !requestState.success ? (
        <div className="qf-mgmt-dialog-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="qf-mgmt-dialog-overlay"
            aria-label="Cancel"
            onClick={() => setRequestOpen(false)}
          />
          <form action={requestAction} className="qf-mgmt-dialog-panel">
            <h2 className="qf-mgmt-dialog-title">Request payment</h2>
            <p className="qf-mgmt-dialog-description">
              Send {customerName || "the customer"} a payment request for{" "}
              {jobTitle}.
            </p>
            <input type="hidden" name="proposalId" value={proposalId} />
            <label className="qf-completed-jobs-search">
              <span className="qf-field-label">Amount due</span>
              <input
                className="form-input"
                name="amountPounds"
                type="number"
                min="0"
                step="0.01"
                defaultValue={defaultPounds}
              />
            </label>
            <fieldset className="qf-payment-methods">
              <legend className="qf-field-label">Payment methods</legend>
              {enabledMethods.length === 0 ? (
                <p className="qf-mgmt-dialog-description">
                  Add a payment method in Settings → Payments first.
                </p>
              ) : (
                enabledMethods.map((method) => (
                  <label key={method} className="qf-payment-method-toggle">
                    <input type="checkbox" name="methods" value={method} defaultChecked />
                    <span>{PAYMENT_METHOD_LABELS[method]}</span>
                  </label>
                ))
              )}
            </fieldset>
            <div className="qf-mgmt-dialog-actions">
              <button
                type="button"
                className="qf-btn-secondary"
                onClick={() => setRequestOpen(false)}
              >
                Cancel
              </button>
              <PendingButton label="Send payment request" pendingLabel="Sending…" />
            </div>
          </form>
        </div>
      ) : null}

      {paidOpen && !paidState.success ? (
        <div className="qf-mgmt-dialog-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="qf-mgmt-dialog-overlay"
            aria-label="Cancel"
            onClick={() => setPaidOpen(false)}
          />
          <form action={paidAction} className="qf-mgmt-dialog-panel">
            <h2 className="qf-mgmt-dialog-title">Mark this payment as received?</h2>
            <p className="qf-mgmt-dialog-description">
              Only do this after the money has actually arrived.
            </p>
            <input type="hidden" name="proposalId" value={proposalId} />
            <div className="qf-mgmt-dialog-actions">
              <button
                type="button"
                className="qf-btn-secondary"
                onClick={() => setPaidOpen(false)}
              >
                Cancel
              </button>
              <PendingButton label="Mark as paid" pendingLabel="Saving…" />
            </div>
          </form>
        </div>
      ) : null}

      {closeOpen && !closeState.success ? (
        <div className="qf-mgmt-dialog-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="qf-mgmt-dialog-overlay"
            aria-label="Cancel"
            onClick={() => setCloseOpen(false)}
          />
          <form action={closeAction} className="qf-mgmt-dialog-panel">
            <h2 className="qf-mgmt-dialog-title">Close this job?</h2>
            <p className="qf-mgmt-dialog-description">
              The full record stays in Closed Jobs. Nothing is deleted.
            </p>
            <input type="hidden" name="proposalId" value={proposalId} />
            <div className="qf-mgmt-dialog-actions">
              <button
                type="button"
                className="qf-btn-secondary"
                onClick={() => setCloseOpen(false)}
              >
                Cancel
              </button>
              <PendingButton label="Close job" pendingLabel="Closing…" />
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
