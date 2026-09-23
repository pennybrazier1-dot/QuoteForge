"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  resendToCustomer,
  type LifecycleActionState,
} from "@/app/proposals/lifecycle-actions";
import {
  updateProposalStatus,
  type UpdateProposalStatusState,
} from "@/app/proposals/status-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { useSendProposalDialog } from "@/components/proposals/send-proposal-provider";
import {
  canEditProposalActions,
  canMarkProposalReadyToSend,
  canOpenSendProposalDialog,
  canPreviewProposalPdf,
  getResendWaitingEnablement,
  canUseSendAction,
  getSendDisabledReason,
  type ProposalActionContext,
} from "@/lib/proposals/proposal-action-eligibility";
import {
  RESEND_FAILURE_COPY,
  RESEND_PENDING_COPY,
  RESEND_SUCCESS_COPY,
} from "@/lib/proposals/resend-proposal-email";
import { isProposalStatus } from "@/lib/proposals/status";

const initialState: UpdateProposalStatusState = {};
const resendInitialState: LifecycleActionState = {};

type ProposalWorkspaceActionsProps = {
  proposalId: string;
  status: string;
  actionContext: ProposalActionContext;
};

const SEND_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

const PDF_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);

const EDIT_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

function ResendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`qf-workspace-action qf-workspace-action-primary${
        disabled ? " qf-workspace-action-disabled" : ""
      }`}
    >
      {SEND_ICON}
      <span className="qf-workspace-action-label">
        <span className="qf-workspace-action-label-short">
          {pending ? "…" : "Resend"}
        </span>
        <span className="qf-workspace-action-label-long">
          {pending ? RESEND_PENDING_COPY : "Resend proposal"}
        </span>
      </span>
    </button>
  );
}

function MarkReadyButton({
  formAction,
  proposalId,
  pendingLabel,
}: {
  formAction: (payload: FormData) => void;
  proposalId: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="qf-workspace-actions-item">
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="newStatus" value="ready_to_send" />
      <button
        type="submit"
        disabled={pending}
        className="qf-workspace-action qf-workspace-action-primary"
      >
        {SEND_ICON}
        <span className="qf-workspace-action-label">
          <span className="qf-workspace-action-label-short">
            {pending ? "…" : "Send"}
          </span>
          <span className="qf-workspace-action-label-long">
            {pending ? pendingLabel : "Send to Customer"}
          </span>
        </span>
      </button>
    </form>
  );
}

export function ProposalWorkspaceActions({
  proposalId,
  status,
  actionContext,
}: ProposalWorkspaceActionsProps) {
  const [state, formAction] = useActionState(updateProposalStatus, initialState);
  const [resendState, resendAction] = useActionState(
    resendToCustomer,
    resendInitialState
  );
  const { openSendDialog } = useSendProposalDialog();
  const canEdit = canEditProposalActions(status);
  const canPreview = canPreviewProposalPdf(actionContext);
  const canSend = canUseSendAction(actionContext);
  const canOpenSend = canOpenSendProposalDialog(actionContext);
  const resendWaiting = getResendWaitingEnablement({
    status,
    customerEmail: actionContext.customer_email,
    linkedCustomerEmail: actionContext.linked_customer_email,
  });
  const canResendWaiting = resendWaiting.shown;
  const canResendWaitingNow = resendWaiting.enabled;
  const sendDisabledReason = getSendDisabledReason(actionContext);
  const showMarkReady =
    isProposalStatus(status) &&
    status === "draft" &&
    canMarkProposalReadyToSend(actionContext);

  return (
    <section className="qf-workspace-actions" aria-label="Proposal actions">
      {state.error || resendState.error ? (
        <AuthError
          message={
            resendState.error
              ? RESEND_FAILURE_COPY
              : state.error || RESEND_FAILURE_COPY
          }
        />
      ) : null}
      {resendState.success ? (
        <p className="qf-workspace-actions-success" role="status">
          {RESEND_SUCCESS_COPY}
        </p>
      ) : null}

      <div className="qf-workspace-actions-list">
        {canResendWaiting ? (
          <form action={resendAction} className="qf-workspace-actions-item">
            <input type="hidden" name="proposalId" value={proposalId} />
            <ResendButton disabled={!canResendWaitingNow} />
          </form>
        ) : canOpenSend ? (
          <button
            type="button"
            onClick={openSendDialog}
            className="qf-workspace-action qf-workspace-action-primary"
          >
            {SEND_ICON}
            <span className="qf-workspace-action-label">
              <span className="qf-workspace-action-label-short">Send</span>
              <span className="qf-workspace-action-label-long">
                Send to Customer
              </span>
            </span>
          </button>
        ) : showMarkReady ? (
          <MarkReadyButton
            formAction={formAction}
            proposalId={proposalId}
            pendingLabel="Preparing…"
          />
        ) : (
          <span
            className="qf-workspace-action qf-workspace-action-primary qf-workspace-action-disabled"
            aria-disabled="true"
            title={sendDisabledReason ?? undefined}
          >
            {SEND_ICON}
            <span className="qf-workspace-action-label">
              <span className="qf-workspace-action-label-short">Send</span>
              <span className="qf-workspace-action-label-long">
                Send to Customer
              </span>
            </span>
          </span>
        )}

        {canPreview ? (
          <a
            href={`/proposals/${proposalId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="qf-workspace-action qf-workspace-action-secondary"
          >
            {PDF_ICON}
            <span className="qf-workspace-action-label">PDF</span>
          </a>
        ) : (
          <span
            className="qf-workspace-action qf-workspace-action-secondary qf-workspace-action-disabled"
            aria-disabled="true"
          >
            {PDF_ICON}
            <span className="qf-workspace-action-label">PDF</span>
          </span>
        )}

        {canEdit ? (
          <Link
            href={`/proposals/${proposalId}/edit`}
            className="qf-workspace-action qf-workspace-action-secondary"
          >
            {EDIT_ICON}
            <span className="qf-workspace-action-label">
              <span className="qf-workspace-action-label-short">Edit</span>
              <span className="qf-workspace-action-label-long">
                Edit Proposal
              </span>
            </span>
          </Link>
        ) : (
          <span
            className="qf-workspace-action qf-workspace-action-secondary qf-workspace-action-disabled"
            aria-disabled="true"
          >
            {EDIT_ICON}
            <span className="qf-workspace-action-label">
              <span className="qf-workspace-action-label-short">Edit</span>
              <span className="qf-workspace-action-label-long">
                Edit Proposal
              </span>
            </span>
          </span>
        )}
      </div>

      {canResendWaiting && !canResendWaitingNow ? (
        <p className="qf-workspace-actions-hint">
          Add a customer email address to resend this proposal.
        </p>
      ) : !canSend && !canResendWaiting && sendDisabledReason ? (
        <p className="qf-workspace-actions-hint">{sendDisabledReason}</p>
      ) : null}
    </section>
  );
}
