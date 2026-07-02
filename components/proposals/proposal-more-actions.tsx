"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  cancelProposal,
  deleteProposal,
  type ProposalManagementState,
} from "@/app/proposals/management-actions";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import { RearrangeProposalDialog } from "@/components/proposals/rearrange-proposal-dialog";
import { canCancelProposal } from "@/lib/proposals/status";

const initialState: ProposalManagementState = {};

type ActiveDialog = "cancel" | "delete" | "rearrange" | null;

type ProposalMoreActionsProps = {
  proposalId: string;
  proposalNumber: string;
  status: string;
  plannedStartDateText: string | null;
  plannedStartDate: string | null;
  estimatedDuration: string | null;
};

export function ProposalMoreActions({
  proposalId,
  proposalNumber,
  status,
  plannedStartDateText,
  plannedStartDate,
  estimatedDuration,
}: ProposalMoreActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const showCancel = canCancelProposal(status);

  useEffect(() => {
    if (searchParams.get("rearrange") === "1") {
      setActiveDialog("rearrange");
      router.replace(`/proposals/${proposalId}`, { scroll: false });
    }
  }, [proposalId, router, searchParams]);

  function closeDialog() {
    setActiveDialog(null);
  }

  return (
    <section className="qf-workspace-more-actions" aria-label="More actions">
      <h2 className="qf-workspace-more-actions-title">More actions</h2>

      <div className="qf-workspace-more-actions-list">
        <button
          type="button"
          className="qf-workspace-more-action"
          onClick={() => setActiveDialog("rearrange")}
        >
          Rearrange
        </button>

        {showCancel ? (
          <button
            type="button"
            className="qf-workspace-more-action"
            onClick={() => setActiveDialog("cancel")}
          >
            Cancel
          </button>
        ) : null}

        <button
          type="button"
          className="qf-workspace-more-action qf-workspace-more-action-danger"
          onClick={() => setActiveDialog("delete")}
        >
          Delete
        </button>
      </div>

      <RearrangeProposalDialog
        open={activeDialog === "rearrange"}
        onClose={closeDialog}
        proposalId={proposalId}
        plannedStartDateText={plannedStartDateText}
        plannedStartDate={plannedStartDate}
        estimatedDuration={estimatedDuration}
      />

      <CancelProposalDialog
        open={activeDialog === "cancel"}
        proposalId={proposalId}
        proposalNumber={proposalNumber}
        onClose={closeDialog}
      />

      <DeleteProposalDialog
        open={activeDialog === "delete"}
        proposalId={proposalId}
        proposalNumber={proposalNumber}
        onClose={closeDialog}
      />
    </section>
  );
}

function CancelProposalDialog({
  open,
  proposalId,
  proposalNumber,
  onClose,
}: {
  open: boolean;
  proposalId: string;
  proposalNumber: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(cancelProposal, initialState);

  if (!open) {
    return null;
  }

  return (
    <form id={`cancel-proposal-form-${proposalId}`} action={formAction}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <CancelProposalDialogBody
        proposalId={proposalId}
        proposalNumber={proposalNumber}
        error={state.error}
        onClose={onClose}
      />
    </form>
  );
}

function CancelProposalDialogBody({
  proposalId,
  proposalNumber,
  error,
  onClose,
}: {
  proposalId: string;
  proposalNumber: string;
  error?: string;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <ProposalConfirmDialog
      open
      title="Cancel this proposal?"
      description={
        <>
          <p>
            This will mark{" "}
            <span className="font-medium text-foreground">{proposalNumber}</span>{" "}
            as cancelled.
          </p>
          <p className="mt-2">
            The record stays in your history, but it will be removed from your
            active Home sections.
          </p>
        </>
      }
      confirmLabel="Cancel proposal"
      pendingLabel="Cancelling…"
      pending={pending}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        (
          document.getElementById(
            `cancel-proposal-form-${proposalId}`
          ) as HTMLFormElement | null
        )?.requestSubmit();
      }}
    />
  );
}

function DeleteProposalDialog({
  open,
  proposalId,
  proposalNumber,
  onClose,
}: {
  open: boolean;
  proposalId: string;
  proposalNumber: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(deleteProposal, initialState);

  if (!open) {
    return null;
  }

  return (
    <form id={`delete-proposal-form-${proposalId}`} action={formAction}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <DeleteProposalDialogBody
        proposalId={proposalId}
        proposalNumber={proposalNumber}
        error={state.error}
        onClose={onClose}
      />
    </form>
  );
}

function DeleteProposalDialogBody({
  proposalId,
  proposalNumber,
  error,
  onClose,
}: {
  proposalId: string;
  proposalNumber: string;
  error?: string;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <ProposalConfirmDialog
      open
      title="Delete this proposal?"
      description={
        <>
          <p>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">{proposalNumber}</span>
            .
          </p>
          <p className="mt-2 font-medium text-red-300">This cannot be undone.</p>
        </>
      }
      confirmLabel="Delete permanently"
      pendingLabel="Deleting…"
      pending={pending}
      destructive
      error={error}
      onClose={onClose}
      onConfirm={() => {
        (
          document.getElementById(
            `delete-proposal-form-${proposalId}`
          ) as HTMLFormElement | null
        )?.requestSubmit();
      }}
    />
  );
}
