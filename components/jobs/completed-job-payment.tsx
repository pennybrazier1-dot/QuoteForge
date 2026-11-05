"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import {
  closeJobAction,
  markJobPaidAction,
  recordInvoicePaymentAction,
  requestJobPaymentAction,
  waiveJobPaymentAction,
  type PaymentActionState,
} from "@/lib/payments/actions";
import {
  canCloseJob,
  canMarkPaymentPaid,
  canRecordInvoicePayment,
  canRequestPayment,
  canWaivePayment,
  CLOSE_JOB_BLOCKED_COPY,
  defaultPaymentDueAmount,
  formatPaymentStatus,
  PAYMENT_METHOD_LABELS,
  poundsInputToPence,
} from "@/lib/payments/job-payment";
import type { InvoicePaymentPanelData } from "@/lib/payments/load-invoice-payment-panel";
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

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function newRecordIdempotencyKey(invoiceId: string): string {
  return `manual/${invoiceId}/${crypto.randomUUID()}`;
}

type RecordDraft = {
  amountPounds: string;
  method: PaymentMethod | string;
  paidOn: string;
  reference: string;
  note: string;
};

/**
 * Owns record action state. Remount with a new `idempotencyKey` after each
 * successful payment so traders can record the next instalment. Keep the same
 * key when retrying an uncertain/failed attempt for the same draft.
 */
function RecordPaymentDialog({
  proposalId,
  invoiceId,
  balanceDue,
  enabledMethods,
  idempotencyKey,
  draft,
  onDraftChange,
  onClose,
  onRetry,
  onRecorded,
}: {
  proposalId: string;
  invoiceId: string;
  balanceDue: number;
  enabledMethods: PaymentMethod[];
  idempotencyKey: string;
  draft: RecordDraft;
  onDraftChange: (draft: RecordDraft) => void;
  onClose: () => void;
  onRetry: () => void;
  onRecorded: (result: PaymentActionState) => void;
}) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [clientError, setClientError] = useState<string | null>(null);
  const [recordState, recordAction] = useActionState(
    recordInvoicePaymentAction,
    initialState
  );
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!recordState.success || recordedRef.current) {
      return;
    }
    recordedRef.current = true;
    onRecorded(recordState);
  }, [recordState, onRecorded]);

  const methods =
    enabledMethods.length > 0
      ? enabledMethods
      : (["bank_transfer"] as PaymentMethod[]);

  function goConfirm() {
    const amountPence = poundsInputToPence(draft.amountPounds);
    if (amountPence == null) {
      setClientError("Enter a valid payment amount greater than zero.");
      return;
    }
    if (amountPence > balanceDue) {
      setClientError(
        `Payment cannot be more than the outstanding balance (${formatPenceAsGbp(balanceDue)}).`
      );
      return;
    }
    if (!draft.method) {
      setClientError("Choose a payment method.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.paidOn)) {
      setClientError("Enter the date the payment was received.");
      return;
    }
    setClientError(null);
    setStep("confirm");
  }

  function onConfirmSubmit(event: FormEvent<HTMLFormElement>) {
    // Hidden idempotency key is already in the form; PendingButton disables
    // while pending. Server RPC remains authoritative.
    if (recordedRef.current) {
      event.preventDefault();
    }
  }

  return (
    <div className="qf-mgmt-dialog-root" role="dialog" aria-modal="true">
      <button
        type="button"
        className="qf-mgmt-dialog-overlay"
        aria-label="Cancel"
        onClick={onClose}
      />
      {recordState.error ? (
        <div className="qf-mgmt-dialog-panel">
          <h2 className="qf-mgmt-dialog-title">Payment not recorded</h2>
          <AuthError message={recordState.error} />
          <p className="qf-mgmt-dialog-description">
            Refresh the job if you are unsure whether the payment was saved
            before trying again.
          </p>
          <div className="qf-mgmt-dialog-actions">
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="qf-btn-primary"
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        </div>
      ) : step === "form" ? (
        <div className="qf-mgmt-dialog-panel">
          <h2 className="qf-mgmt-dialog-title">Record payment</h2>
          <p className="qf-mgmt-dialog-description">
            Outstanding balance: {formatPenceAsGbp(balanceDue)}. Only record
            money that has already arrived — this does not collect payment from
            the customer.
          </p>
          {clientError ? <AuthError message={clientError} /> : null}
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Amount received (£)</span>
            <input
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              max={(balanceDue / 100).toFixed(2)}
              inputMode="decimal"
              value={draft.amountPounds}
              onChange={(event) =>
                onDraftChange({ ...draft, amountPounds: event.target.value })
              }
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Payment method</span>
            <select
              className="form-input"
              value={draft.method}
              onChange={(event) =>
                onDraftChange({ ...draft, method: event.target.value })
              }
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Date received</span>
            <input
              className="form-input"
              type="date"
              value={draft.paidOn}
              onChange={(event) =>
                onDraftChange({ ...draft, paidOn: event.target.value })
              }
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Reference (optional)</span>
            <input
              className="form-input"
              type="text"
              value={draft.reference}
              onChange={(event) =>
                onDraftChange({ ...draft, reference: event.target.value })
              }
              placeholder="Bank reference"
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Note (optional)</span>
            <input
              className="form-input"
              type="text"
              value={draft.note}
              onChange={(event) =>
                onDraftChange({ ...draft, note: event.target.value })
              }
              placeholder="e.g. Deposit, instalment 2"
            />
          </label>
          <div className="qf-mgmt-dialog-actions">
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="qf-btn-primary"
              onClick={goConfirm}
            >
              Review payment
            </button>
          </div>
        </div>
      ) : (
        <form
          action={recordAction}
          className="qf-mgmt-dialog-panel"
          onSubmit={onConfirmSubmit}
        >
          <h2 className="qf-mgmt-dialog-title">Confirm payment?</h2>
          <p className="qf-mgmt-dialog-description">
            Record{" "}
            {formatPenceAsGbp(poundsInputToPence(draft.amountPounds) ?? 0)} via{" "}
            {PAYMENT_METHOD_LABELS[draft.method as PaymentMethod] ??
              draft.method}{" "}
            received on {draft.paidOn}. This only updates your records — it does
            not take money from the customer.
          </p>
          <input type="hidden" name="proposalId" value={proposalId} />
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="amountPounds" value={draft.amountPounds} />
          <input type="hidden" name="method" value={draft.method} />
          <input type="hidden" name="paidOn" value={draft.paidOn} />
          <input type="hidden" name="reference" value={draft.reference} />
          <input type="hidden" name="note" value={draft.note} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="qf-mgmt-dialog-actions">
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setStep("form")}
            >
              Back
            </button>
            <PendingButton
              label="Record payment"
              pendingLabel="Recording…"
            />
          </div>
        </form>
      )}
    </div>
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
  paymentPanel,
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
  paymentPanel?: InvoicePaymentPanelData | null;
}) {
  const router = useRouter();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestEventId, setRequestEventId] = useState(() =>
    crypto.randomUUID()
  );
  const [paidOpen, setPaidOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordKey, setRecordKey] = useState(0);
  const [recordIdempotencyKey, setRecordIdempotencyKey] = useState<string | null>(
    null
  );
  const [recordWarning, setRecordWarning] = useState<string | undefined>();
  const [draft, setDraft] = useState<RecordDraft>({
    amountPounds: "",
    method: enabledMethods[0] ?? "bank_transfer",
    paidOn: todayIsoDate(),
    reference: "",
    note: "",
  });

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

  const invoiceId = paymentPanel?.invoiceId ?? null;
  const balanceDuePence = paymentPanel?.balanceDuePence ?? null;
  const hasApprovedInvoice = Boolean(invoiceId);
  const showRequest = canRequestPayment({
    jobStatus,
    paymentStatus,
    closedAt,
  });
  const showRecord = canRecordInvoicePayment({
    jobStatus,
    paymentStatus,
    closedAt,
    balanceDuePence,
    hasApprovedInvoice,
  });
  const showPaid = canMarkPaymentPaid({
    jobStatus,
    paymentStatus,
    closedAt,
    balanceDuePence,
    hasApprovedInvoice,
  });
  const showWaive = canWaivePayment({ jobStatus, paymentStatus, closedAt });
  const showClose = canCloseJob({ jobStatus, paymentStatus, closedAt });
  const defaultPounds = (
    defaultPaymentDueAmount(paymentDueAmount ?? proposalTotal) / 100
  ).toFixed(2);
  const isFullySettled =
    paymentStatus === "paid" ||
    (hasApprovedInvoice && (balanceDuePence ?? 0) === 0);

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
    recordWarning ||
    requestState.warning ||
    paidState.warning ||
    closeState.warning;

  function openRecordDialog() {
    if (!invoiceId || !showRecord) return;
    setRecordWarning(undefined);
    setDraft({
      amountPounds: "",
      method: enabledMethods[0] ?? "bank_transfer",
      paidOn: todayIsoDate(),
      reference: "",
      note: "",
    });
    setRecordIdempotencyKey(newRecordIdempotencyKey(invoiceId));
    setRecordKey((value) => value + 1);
    setRecordOpen(true);
  }

  function handleRecorded(result: PaymentActionState) {
    setRecordOpen(false);
    setRecordIdempotencyKey(null);
    setRecordWarning(result.warning);
    router.refresh();
  }

  function retryRecord() {
    // Same idempotency key + draft; remount clears action error UI only.
    setRecordKey((value) => value + 1);
  }

  return (
    <section className="qf-workspace-lifecycle" aria-label="Payment">
      <div className="qf-workspace-lifecycle-block">
        <p className="qf-workspace-lifecycle-label">Work completed</p>
        <p className="qf-payment-status-line">
          Payment status: {formatPaymentStatus(paymentStatus)}
        </p>
        {paymentPanel?.invoiceId ? (
          <>
            <p className="qf-payment-status-line">
              Invoice total: {formatPenceAsGbp(paymentPanel.totalAmountPence)}
            </p>
            <p className="qf-payment-status-line">
              Already paid: {formatPenceAsGbp(paymentPanel.amountPaidPence)}
            </p>
            <p className="qf-payment-status-line">
              Outstanding: {formatPenceAsGbp(paymentPanel.balanceDuePence)}
            </p>
            {paymentPanel.entries.length > 0 ? (
              <ul className="qf-payment-status-line">
                {paymentPanel.entries.map((entry) => (
                  <li key={entry.id}>
                    {formatPenceAsGbp(entry.amountPence)} · {entry.methodLabel}
                    {entry.paidOn ? ` · ${entry.paidOn}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : paymentDueAmount != null && paymentStatus !== "not_requested" ? (
          <p className="qf-payment-status-line">
            Amount due: {formatPenceAsGbp(paymentDueAmount)}
          </p>
        ) : null}
        {isFullySettled && !closedAt ? (
          <p className="qf-payment-status-hint">
            Invoice is fully paid. Closing the job is a separate step.
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
              onClick={() => {
                setRequestEventId(crypto.randomUUID());
                setRequestOpen(true);
              }}
            >
              Request payment
            </button>
          ) : null}
          {showRecord ? (
            <button
              type="button"
              className="qf-btn-primary"
              onClick={openRecordDialog}
            >
              Record payment
            </button>
          ) : null}
          {showPaid ? (
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setPaidOpen(true)}
            >
              Mark remaining as paid
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
            <input type="hidden" name="requestEventId" value={requestEventId} />
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
                    <input
                      type="checkbox"
                      name="methods"
                      value={method}
                      defaultChecked
                    />
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
              <PendingButton
                label="Send payment request"
                pendingLabel="Sending…"
              />
            </div>
          </form>
        </div>
      ) : null}

      {recordOpen &&
      invoiceId &&
      recordIdempotencyKey &&
      showRecord ? (
        <RecordPaymentDialog
          key={recordKey}
          proposalId={proposalId}
          invoiceId={invoiceId}
          balanceDue={Math.max(0, balanceDuePence ?? 0)}
          enabledMethods={enabledMethods}
          idempotencyKey={recordIdempotencyKey}
          draft={draft}
          onDraftChange={setDraft}
          onClose={() => {
            setRecordOpen(false);
            setRecordIdempotencyKey(null);
          }}
          onRetry={retryRecord}
          onRecorded={handleRecorded}
        />
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
            <h2 className="qf-mgmt-dialog-title">
              Mark the remaining balance as received?
            </h2>
            <p className="qf-mgmt-dialog-description">
              Only do this after the money has actually arrived
              {balanceDuePence != null
                ? ` (${formatPenceAsGbp(balanceDuePence)} outstanding)`
                : ""}
              . This does not close the job.
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
              <PendingButton
                label="Mark remaining as paid"
                pendingLabel="Saving…"
              />
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
