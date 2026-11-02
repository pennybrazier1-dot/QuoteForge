"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { invoiceReviewHref } from "@/lib/invoices/attention";
import {
  INVOICE_PREPARE_FAILED_NOTICE,
  RETRY_INVOICE_LABEL,
} from "@/lib/invoices/missing-invoice-attention";
import {
  retryPrepareInvoiceDraftAction,
  type InvoiceActionState,
} from "@/lib/invoices/actions";

const initialState: InvoiceActionState = {};

function RetryButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Preparing…" : RETRY_INVOICE_LABEL}
    </button>
  );
}

export function InvoicePrepareRecovery({
  proposalId,
  customerName,
  jobTitle,
}: {
  proposalId: string;
  customerName: string | null;
  jobTitle: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    retryPrepareInvoiceDraftAction,
    initialState
  );

  useEffect(() => {
    if (state.success && state.invoice) {
      router.refresh();
    }
  }, [state.success, state.invoice, router]);

  return (
    <div className="qf-invoice-review">
      <div className="qf-invoice-review-top">
        <Link href={`/proposals/${proposalId}`} className="qf-invoice-back-link">
          Back to job
        </Link>
      </div>

      <header className="qf-card qf-invoice-hero">
        <p className="qf-invoice-kicker">Invoice needs preparing</p>
        <h1 className="qf-invoice-title">{jobTitle}</h1>
        {customerName ? (
          <p className="qf-invoice-sub">{customerName}</p>
        ) : null}
      </header>

      <section className="qf-card qf-invoice-section">
        <p className="qf-invoice-plain">{INVOICE_PREPARE_FAILED_NOTICE}</p>
        <p className="qf-invoice-muted">
          The job is already completed. Retry prepares the missing invoice draft
          without changing payment status or sending email.
        </p>
        {state.error ? <AuthError message={state.error} /> : null}
        <form action={action} className="qf-invoice-actions qf-mobile-bottom-actions">
          <input type="hidden" name="proposalId" value={proposalId} />
          <RetryButton />
          <Link
            href={invoiceReviewHref(proposalId)}
            className="qf-btn-secondary"
          >
            Refresh
          </Link>
        </form>
      </section>
    </div>
  );
}
