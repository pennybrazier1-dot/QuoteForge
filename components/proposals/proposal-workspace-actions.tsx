"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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
  canUseSendAction,
  getSendDisabledReason,
  type ProposalActionContext,
} from "@/lib/proposals/proposal-action-eligibility";
import { isProposalStatus, type ProposalStatus } from "@/lib/proposals/status";

const initialState: UpdateProposalStatusState = {};

type ProposalWorkspaceActionsProps = {
  proposalId: string;
  status: string;
  actionContext: ProposalActionContext;
};

function SendButton({
  formAction,
  proposalId,
  newStatus,
  label,
  pendingLabel,
}: {
  formAction: (payload: FormData) => void;
  proposalId: string;
  newStatus: ProposalStatus;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="qf-workspace-actions-send-form">
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="newStatus" value={newStatus} />
      <button
        type="submit"
        disabled={pending}
        className="qf-workspace-btn qf-workspace-btn-primary"
      >
        <svg
          width="16"
          height="16"
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
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

function PdfButton({
  proposalId,
  enabled,
}: {
  proposalId: string;
  enabled: boolean;
}) {
  const content = (
    <>
      <svg
        width="16"
        height="16"
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
      <span className="qf-workspace-btn-label-short">PDF</span>
      <span className="qf-workspace-btn-label-long">Preview PDF</span>
    </>
  );

  if (enabled) {
    return (
      <a
        href={`/proposals/${proposalId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="qf-workspace-btn qf-workspace-btn-secondary qf-workspace-btn-pdf"
      >
        {content}
      </a>
    );
  }

  return (
    <span
      className="qf-workspace-btn qf-workspace-btn-secondary qf-workspace-btn-disabled qf-workspace-btn-pdf"
      aria-disabled="true"
    >
      {content}
    </span>
  );
}

export function ProposalWorkspaceActions({
  proposalId,
  status,
  actionContext,
}: ProposalWorkspaceActionsProps) {
  const [state, formAction] = useActionState(updateProposalStatus, initialState);
  const { openSendDialog } = useSendProposalDialog();
  const canEdit = canEditProposalActions(status);
  const canPreview = canPreviewProposalPdf(actionContext);
  const canSend = canUseSendAction(actionContext);
  const canOpenSend = canOpenSendProposalDialog(actionContext);
  const sendDisabledReason = getSendDisabledReason(actionContext);
  const showMarkReady =
    isProposalStatus(status) &&
    status === "draft" &&
    canMarkProposalReadyToSend(actionContext);

  return (
    <div className="qf-workspace-actions">
      {state.error ? <AuthError message={state.error} /> : null}

      <div className="qf-workspace-actions-row">
        {canEdit ? (
          <Link
            href={`/proposals/${proposalId}/edit`}
            className="qf-workspace-btn qf-workspace-btn-secondary"
          >
            <svg
              width="16"
              height="16"
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
            Edit
          </Link>
        ) : (
          <span
            className="qf-workspace-btn qf-workspace-btn-secondary qf-workspace-btn-disabled"
            aria-disabled="true"
          >
            <svg
              width="16"
              height="16"
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
            Edit
          </span>
        )}

        <PdfButton proposalId={proposalId} enabled={canPreview} />

        {canOpenSend ? (
          <button
            type="button"
            onClick={openSendDialog}
            className="qf-workspace-btn qf-workspace-btn-primary"
          >
            <svg
              width="16"
              height="16"
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
            Send
          </button>
        ) : showMarkReady ? (
          <SendButton
            formAction={formAction}
            proposalId={proposalId}
            newStatus="ready_to_send"
            label="Send"
            pendingLabel="Preparing…"
          />
        ) : (
          <span
            className="qf-workspace-btn qf-workspace-btn-primary qf-workspace-btn-disabled"
            aria-disabled="true"
            title={sendDisabledReason ?? undefined}
          >
            <svg
              width="16"
              height="16"
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
            Send
          </span>
        )}
      </div>

      {!canSend && sendDisabledReason ? (
        <p className="qf-workspace-actions-hint">{sendDisabledReason}</p>
      ) : null}
    </div>
  );
}
