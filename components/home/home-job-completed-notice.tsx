"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  JOB_COMPLETED_NOTICE,
  jobCompletedNoticeSupport,
} from "@/lib/jobs/complete-job";
import {
  INVOICE_PREPARE_FAILED_NOTICE,
  RETRY_INVOICE_LABEL,
} from "@/lib/invoices/missing-invoice-attention";
import {
  retryPrepareInvoiceDraftAction,
  type InvoiceActionState,
} from "@/lib/invoices/actions";
import { invoiceReviewHref } from "@/lib/invoices/attention";
import { TRADER_HOME_PATH } from "@/lib/visits/new-visit";

const initialRetryState: InvoiceActionState = {};

function RetrySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Preparing…" : RETRY_INVOICE_LABEL}
    </button>
  );
}

export function HomeJobCompletedNotice({
  customerName,
  invoiceFailed = false,
  proposalId = null,
}: {
  customerName?: string | null;
  invoiceFailed?: boolean;
  proposalId?: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [retryState, retryAction] = useActionState(
    retryPrepareInvoiceDraftAction,
    initialRetryState
  );
  const support = jobCompletedNoticeSupport(customerName);

  useEffect(() => {
    if (retryState.success && retryState.invoice && proposalId) {
      router.replace(invoiceReviewHref(proposalId));
    }
  }, [retryState.success, retryState.invoice, proposalId, router]);

  if (!visible) {
    return null;
  }

  if (invoiceFailed) {
    return (
      <div
        className="qf-workspace-notice qf-workspace-notice-warning"
        role="alert"
      >
        <div className="qf-workspace-notice-copy">
          <p className="qf-workspace-notice-title">{JOB_COMPLETED_NOTICE}</p>
          <p className="qf-workspace-notice-body">
            {INVOICE_PREPARE_FAILED_NOTICE}
          </p>
          {retryState.error ? (
            <p className="qf-workspace-notice-body qf-invoice-line-warn">
              {retryState.error}
            </p>
          ) : null}
          {proposalId ? (
            <form action={retryAction} className="qf-workspace-notice-actions">
              <input type="hidden" name="proposalId" value={proposalId} />
              <RetrySubmitButton />
            </form>
          ) : null}
        </div>
        <button
          type="button"
          className="qf-workspace-notice-dismiss"
          onClick={() => {
            setVisible(false);
            router.replace(TRADER_HOME_PATH, { scroll: false });
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="qf-workspace-notice qf-workspace-notice-success" role="status">
      <div>
        <p className="qf-workspace-notice-title">{JOB_COMPLETED_NOTICE}</p>
        {support ? (
          <p className="qf-workspace-notice-body">{support}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="qf-workspace-notice-dismiss"
        onClick={() => {
          setVisible(false);
          router.replace(TRADER_HOME_PATH, { scroll: false });
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
