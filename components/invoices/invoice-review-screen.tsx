"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import {
  approveInvoiceAction,
  saveInvoiceDraftAction,
  sendInvoiceEmailAction,
  type InvoiceActionState,
} from "@/lib/invoices/actions";
import {
  canShowInvoiceEmailButton,
  describeInvoiceEmailFeedback,
} from "@/lib/invoices/email-issued";
import type { InvoiceLineItem, InvoiceRecord } from "@/lib/invoices/types";
import {
  invoiceFlagMessages,
  validateInvoiceDraft,
  withNormalizedPricingStates,
} from "@/lib/invoices/validate-draft";
import { formatPenceAsGbp, formatPenceForInput } from "@/lib/proposals/money";

const initialState: InvoiceActionState = {};

function PendingButton({
  label,
  pendingLabel,
  variant = "primary",
  disabled = false,
  formAction,
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  formAction?: (payload: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={variant === "primary" ? "qf-btn-primary" : "qf-btn-secondary"}
      disabled={pending || disabled}
      formAction={formAction}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function FlagBanner({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="qf-invoice-flag" role="status">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

export function InvoiceReviewScreen({
  invoice: initialInvoice,
  proposalNumber,
  businessVatNumber,
  emailStatus = null,
}: {
  invoice: InvoiceRecord;
  proposalNumber: string;
  businessVatNumber: string | null;
  /** Latest invoice_issued outbound status, when the page has already loaded it. */
  emailStatus?: { status: string; attemptAt: string | null } | null;
}) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lines, setLines] = useState<InvoiceLineItem[]>(() =>
    withNormalizedPricingStates(initialInvoice.line_items)
  );
  const [vatPounds, setVatPounds] = useState(
    formatPenceForInput(initialInvoice.vat_amount)
  );
  const [adjustmentConfirmed, setAdjustmentConfirmed] = useState(
    initialInvoice.adjustment_confirmed
  );
  const [taxConfirmed, setTaxConfirmed] = useState(initialInvoice.tax_confirmed);
  const [notes, setNotes] = useState(initialInvoice.notes ?? "");
  const [saveState, saveAction] = useActionState(
    saveInvoiceDraftAction,
    initialState
  );
  const [approveState, approveAction] = useActionState(
    approveInvoiceAction,
    initialState
  );
  const [emailState, emailAction] = useActionState(
    sendInvoiceEmailAction,
    initialState
  );

  useEffect(() => {
    if (!previewOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  const invoice =
    emailState.invoice ??
    saveState.invoice ??
    approveState.invoice ??
    initialInvoice;
  const isDraft = invoice.status === "draft";
  const isApproved = invoice.status === "approved";

  useEffect(() => {
    if (
      saveState.success ||
      approveState.success ||
      emailState.success ||
      emailState.emailDelivery
    ) {
      router.refresh();
    }
  }, [
    saveState.success,
    approveState.success,
    emailState.success,
    emailState.emailDelivery,
    router,
  ]);

  const liveVat = Math.max(0, Math.round(Number(vatPounds || "0") * 100));

  const validation = useMemo(
    () =>
      validateInvoiceDraft({
        line_items: lines,
        vat_amount: liveVat,
        amount_paid: invoice.amount_paid,
        agreed_total_amount: invoice.agreed_total_amount,
        source_vat_amount: invoice.source_vat_amount,
        adjustment_confirmed: adjustmentConfirmed,
        tax_confirmed: taxConfirmed,
        notes,
      }),
    [
      lines,
      liveVat,
      invoice.amount_paid,
      invoice.agreed_total_amount,
      invoice.source_vat_amount,
      adjustmentConfirmed,
      taxConfirmed,
      notes,
    ]
  );

  const liveSubtotal = validation.subtotal_amount;
  const liveTotal = validation.total_amount;
  const liveBalance = validation.balance_due;
  const flagMessages = invoiceFlagMessages(validation.flags);
  const canApprove = isDraft && validation.canApprove;

  function updateLine(
    id: string,
    patch: Partial<
      Pick<InvoiceLineItem, "description" | "unit_amount" | "pricing_state">
    >
  ) {
    setLines((current) =>
      withNormalizedPricingStates(
        current.map((line) => {
          if (line.id !== id) return line;
          const unitAmount =
            patch.unit_amount != null
              ? Math.max(0, Math.round(patch.unit_amount))
              : line.unit_amount;
          const description =
            patch.description != null ? patch.description : line.description;
          const totalAmount = Math.round(line.quantity * unitAmount);
          let pricingState = patch.pricing_state ?? line.pricing_state;
          if (totalAmount > 0) {
            pricingState = "priced";
          } else if (
            patch.unit_amount != null &&
            totalAmount === 0 &&
            pricingState === "priced"
          ) {
            pricingState = "included_unpriced";
          }
          return {
            ...line,
            description,
            unit_amount: unitAmount,
            total_amount: totalAmount,
            pricing_state: pricingState,
          };
        })
      )
    );
  }

  function confirmLineFree(id: string) {
    updateLine(id, { unit_amount: 0, pricing_state: "zero_confirmed" });
  }

  const error = saveState.error || approveState.error;
  const successMessage = approveState.success
    ? "Invoice approved. No email was sent."
    : saveState.success
      ? "Draft saved."
      : null;
  const hasCustomerEmail = Boolean(invoice.customer_email?.includes("@"));
  const showEmailButton = canShowInvoiceEmailButton({
    status: invoice.status,
    customerEmail: invoice.customer_email,
    outboundStatus: emailStatus?.status,
    session: emailState.emailDelivery,
  });
  const emailFeedback = describeInvoiceEmailFeedback(
    emailState.emailDelivery || emailState.error
      ? {
          ...emailState.emailDelivery,
          error: emailState.error,
        }
      : emailStatus?.status
        ? { status: emailStatus.status }
        : null
  );

  return (
    <div className="qf-invoice-review">
      <div className="qf-invoice-review-top">
        <Link
          href={`/proposals/${invoice.proposal_id}`}
          className="qf-invoice-back-link"
        >
          Back to job
        </Link>
        <span
          className={
            isApproved
              ? "qf-invoice-status qf-invoice-status-approved"
              : "qf-invoice-status qf-invoice-status-draft"
          }
        >
          {isApproved ? "Approved" : "Draft"}
        </span>
      </div>

      <header className="qf-card qf-invoice-hero">
        <p className="qf-invoice-kicker">
          {isApproved ? "Invoice approved" : "Invoice ready for review"}
        </p>
        <h1 className="qf-invoice-title">{invoice.invoice_number}</h1>
        <p className="qf-invoice-sub">
          Job {proposalNumber}
          {invoice.job_title ? ` · ${invoice.job_title}` : ""}
        </p>
        <p className="qf-invoice-amount">
          {formatPenceAsGbp(isDraft ? liveTotal : invoice.total_amount)}
        </p>
        {invoice.agreed_total_amount > 0 ? (
          <p className="qf-invoice-muted">
            Agreed quote: {formatPenceAsGbp(invoice.agreed_total_amount)}
          </p>
        ) : null}
      </header>

      <FlagBanner messages={flagMessages} />
      {error ? <AuthError message={error} /> : null}
      {successMessage ? (
        <p className="qf-workspace-actions-success" role="status">
          {successMessage}
        </p>
      ) : null}

      {isApproved ? (
        <form action={emailAction} className="qf-card qf-invoice-section">
          <input type="hidden" name="proposalId" value={invoice.proposal_id} />
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <h2 className="qf-card-heading">Email this invoice</h2>
          {emailFeedback ? (
            <div role="status">
              <p>{emailFeedback.title}</p>
              <p className="qf-invoice-muted">{emailFeedback.detail}</p>
            </div>
          ) : (
            <p className="qf-invoice-muted">
              Email is separate from approval. Provider acceptance is not proof
              the customer opened the email.
            </p>
          )}
          {showEmailButton ? (
            <div className="qf-invoice-actions">
              <PendingButton
                label="Email invoice to customer"
                pendingLabel="Sending…"
              />
            </div>
          ) : null}
          {!hasCustomerEmail ? (
            <p className="qf-invoice-line-warn" role="status">
              Add a customer email on the invoice before sending. No email was
              sent.
            </p>
          ) : null}
        </form>
      ) : null}

      <form
        action={isDraft ? saveAction : undefined}
        className="qf-invoice-form"
        onSubmit={(event) => {
          if (!isDraft) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="proposalId" value={invoice.proposal_id} />
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <input type="hidden" name="lineItemsJson" value={JSON.stringify(lines)} />
        <input type="hidden" name="vatAmountPence" value={String(liveVat)} />
        <input
          type="hidden"
          name="amountPaidPence"
          value={String(invoice.amount_paid)}
        />
        {adjustmentConfirmed ? (
          <input type="hidden" name="adjustmentConfirmed" value="true" />
        ) : null}
        {taxConfirmed ? (
          <input type="hidden" name="taxConfirmed" value="true" />
        ) : null}
        <input type="hidden" name="notes" value={notes} />

        <section className="qf-card qf-invoice-section">
          <h2 className="qf-card-heading">Business</h2>
          <p className="qf-invoice-plain">
            {invoice.business_name || "Your business"}
          </p>
          {businessVatNumber ? (
            <p className="qf-invoice-muted">VAT: {businessVatNumber}</p>
          ) : null}
        </section>

        <section className="qf-card qf-invoice-section">
          <h2 className="qf-card-heading">Customer</h2>
          {isDraft ? (
            <div className="qf-invoice-fields">
              <label>
                <span className="qf-field-label">Name</span>
                <input
                  className="form-input"
                  name="customerName"
                  defaultValue={invoice.customer_name ?? ""}
                />
              </label>
              <label>
                <span className="qf-field-label">Email</span>
                <input
                  className="form-input"
                  name="customerEmail"
                  defaultValue={invoice.customer_email ?? ""}
                />
              </label>
              <label>
                <span className="qf-field-label">Phone</span>
                <input
                  className="form-input"
                  name="customerPhone"
                  defaultValue={invoice.customer_phone ?? ""}
                />
              </label>
              <label>
                <span className="qf-field-label">Address</span>
                <textarea
                  className="form-input"
                  name="customerAddress"
                  rows={3}
                  defaultValue={invoice.customer_address ?? ""}
                />
              </label>
            </div>
          ) : (
            <div className="qf-invoice-plain-stack">
              <p>{invoice.customer_name || "Customer"}</p>
              {invoice.customer_email ? <p>{invoice.customer_email}</p> : null}
              {invoice.customer_phone ? <p>{invoice.customer_phone}</p> : null}
              {invoice.customer_address ? (
                <p>{invoice.customer_address}</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="qf-card qf-invoice-section">
          <h2 className="qf-card-heading">Job</h2>
          {isDraft ? (
            <div className="qf-invoice-fields">
              <label>
                <span className="qf-field-label">Job title</span>
                <input
                  className="form-input"
                  name="jobTitle"
                  defaultValue={invoice.job_title}
                />
              </label>
              <label>
                <span className="qf-field-label">Job address</span>
                <input
                  className="form-input"
                  name="jobAddress"
                  defaultValue={invoice.job_address ?? ""}
                />
              </label>
              <label>
                <span className="qf-field-label">Work description</span>
                <textarea
                  className="form-input"
                  name="workDescription"
                  rows={4}
                  defaultValue={invoice.work_description ?? ""}
                />
              </label>
            </div>
          ) : (
            <div className="qf-invoice-plain-stack">
              <p>{invoice.job_title}</p>
              {invoice.job_address ? <p>{invoice.job_address}</p> : null}
              {invoice.work_description ? (
                <p className="qf-invoice-pre">{invoice.work_description}</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="qf-card qf-invoice-section">
          <h2 className="qf-card-heading">Line items</h2>
          <p className="qf-invoice-muted">
            Materials listed on the quote start at £0 so they are not charged
            twice on top of the agreed total. Confirm each as free/included, or
            enter a price and reduce labour if needed.
          </p>
          <ul className="qf-invoice-lines">
            {lines.map((line) => (
              <li key={line.id} className="qf-invoice-line">
                <div className="qf-invoice-line-main">
                  <span className="qf-invoice-line-kind">{line.kind}</span>
                  {isDraft ? (
                    <input
                      className="form-input"
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.id, {
                          description: event.target.value,
                        })
                      }
                      aria-label={`${line.kind} description`}
                    />
                  ) : (
                    <p>{line.description}</p>
                  )}
                  {isDraft &&
                  line.total_amount === 0 &&
                  line.pricing_state === "included_unpriced" ? (
                    <button
                      type="button"
                      className="qf-btn-secondary qf-invoice-confirm-free"
                      onClick={() => confirmLineFree(line.id)}
                    >
                      Confirm free / included
                    </button>
                  ) : null}
                  {line.pricing_state === "zero_confirmed" ? (
                    <p className="qf-invoice-muted">Confirmed free / included</p>
                  ) : null}
                  {line.pricing_state === "included_unpriced" ? (
                    <p className="qf-invoice-line-warn">Needs price or confirmation</p>
                  ) : null}
                </div>
                <div className="qf-invoice-line-amount">
                  {isDraft ? (
                    <label>
                      <span className="qf-field-label">Amount (£)</span>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formatPenceForInput(line.unit_amount)}
                        onChange={(event) =>
                          updateLine(line.id, {
                            unit_amount: Math.round(
                              Number(event.target.value || "0") * 100
                            ),
                          })
                        }
                      />
                    </label>
                  ) : (
                    <p>{formatPenceAsGbp(line.total_amount)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="qf-card qf-invoice-section">
          <h2 className="qf-card-heading">Totals</h2>
          <div className="qf-invoice-totals">
            <div className="qf-invoice-total-row">
              <span>Subtotal</span>
              <strong>
                {formatPenceAsGbp(
                  isDraft ? liveSubtotal : invoice.subtotal_amount
                )}
              </strong>
            </div>
            <div className="qf-invoice-total-row">
              <span>VAT</span>
              {isDraft ? (
                <label className="qf-invoice-vat-input">
                  <span className="sr-only">VAT pounds</span>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={vatPounds}
                    onChange={(event) => setVatPounds(event.target.value)}
                  />
                </label>
              ) : (
                <strong>{formatPenceAsGbp(invoice.vat_amount)}</strong>
              )}
            </div>
            <div className="qf-invoice-total-row qf-invoice-total-strong">
              <span>Total</span>
              <strong>
                {formatPenceAsGbp(isDraft ? liveTotal : invoice.total_amount)}
              </strong>
            </div>
            <div className="qf-invoice-total-row">
              <span>Payments recorded</span>
              <strong>{formatPenceAsGbp(invoice.amount_paid)}</strong>
            </div>
            <div className="qf-invoice-total-row qf-invoice-total-strong">
              <span>Balance due</span>
              <strong>
                {formatPenceAsGbp(isDraft ? liveBalance : invoice.balance_due)}
              </strong>
            </div>
          </div>

          {isDraft && validation.flags.includes("total_differs_from_agreed") ? (
            <label className="qf-invoice-confirm">
              <input
                type="checkbox"
                checked={adjustmentConfirmed}
                onChange={(event) =>
                  setAdjustmentConfirmed(event.target.checked)
                }
              />
              <span>
                I confirm this total differs from the agreed quote (
                {formatPenceAsGbp(invoice.agreed_total_amount)})
              </span>
            </label>
          ) : null}

          {isDraft &&
          liveVat > 0 &&
          invoice.source_vat_amount === 0 ? (
            <label className="qf-invoice-confirm">
              <input
                type="checkbox"
                checked={taxConfirmed}
                onChange={(event) => setTaxConfirmed(event.target.checked)}
              />
              <span>I confirm this VAT amount is correct</span>
            </label>
          ) : null}

          {isDraft ? (
            <label className="qf-invoice-notes">
              <span className="qf-field-label">
                Notes
                {validation.flags.includes("total_differs_from_agreed")
                  ? " (required for total adjustment)"
                  : " (optional)"}
              </span>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          ) : invoice.notes ? (
            <p className="qf-invoice-pre">{invoice.notes}</p>
          ) : null}
        </section>

        {isDraft ? (
          <div className="qf-invoice-actions qf-mobile-bottom-actions">
            <PendingButton label="Save Draft" pendingLabel="Saving…" />
            <PendingButton
              label="Approve Invoice"
              pendingLabel="Approving…"
              disabled={!canApprove}
              formAction={approveAction}
            />
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setPreviewOpen(true)}
            >
              Preview Invoice
            </button>
            <a
              className="qf-btn-secondary"
              href={`/proposals/${invoice.proposal_id}/invoice/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preview PDF
            </a>
            {!canApprove ? (
              <p className="qf-invoice-line-warn" role="status">
                Resolve pricing and tax checks before approving.
              </p>
            ) : (
              <p className="qf-invoice-muted">
                Approve locks this invoice. Stage 1 does not send an email.
              </p>
            )}
          </div>
        ) : (
          <div className="qf-invoice-actions qf-mobile-bottom-actions">
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setPreviewOpen(true)}
            >
              Preview Invoice
            </button>
            <a
              className="qf-btn-secondary"
              href={`/proposals/${invoice.proposal_id}/invoice/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preview PDF
            </a>
          </div>
        )}
      </form>

      {previewOpen ? (
        <div className="qf-mgmt-dialog-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="qf-mgmt-dialog-overlay"
            aria-label="Close preview"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="qf-mgmt-dialog-panel qf-invoice-preview-panel">
            <h2 className="qf-mgmt-dialog-title">Invoice preview</h2>
            <p className="qf-invoice-muted">
              Preview only — nothing is emailed from this screen.
            </p>
            <p className="qf-invoice-muted">
              Opening the PDF does not send an email.
            </p>
            <div className="qf-invoice-preview-body">
              <p>
                <strong>{invoice.business_name || "Business"}</strong>
              </p>
              <p>{invoice.invoice_number}</p>
              <p>
                Bill to: {invoice.customer_name || "Customer"}
                {invoice.customer_address
                  ? ` · ${invoice.customer_address}`
                  : ""}
              </p>
              <p>{invoice.job_title}</p>
              <ul>
                {lines.map((line) => (
                  <li key={line.id}>
                    {line.description} — {formatPenceAsGbp(line.total_amount)}
                  </li>
                ))}
              </ul>
              <p>
                Subtotal:{" "}
                {formatPenceAsGbp(
                  isDraft ? liveSubtotal : invoice.subtotal_amount
                )}
              </p>
              <p>VAT: {formatPenceAsGbp(isDraft ? liveVat : invoice.vat_amount)}</p>
              <p>
                <strong>
                  Total:{" "}
                  {formatPenceAsGbp(isDraft ? liveTotal : invoice.total_amount)}
                </strong>
              </p>
              <p>Paid: {formatPenceAsGbp(invoice.amount_paid)}</p>
              <p>
                Balance due:{" "}
                {formatPenceAsGbp(isDraft ? liveBalance : invoice.balance_due)}
              </p>
            </div>
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
