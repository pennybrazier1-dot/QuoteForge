"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteDraftProposal,
  type DeleteDraftProposalState,
} from "@/app/proposals/actions";
import { AuthError } from "@/components/auth/auth-shell";

const initialState: DeleteDraftProposalState = {};

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete Draft"}
    </button>
  );
}

type DeleteDraftSectionProps = {
  proposalId: string;
  proposalNumber: string;
};

export function DeleteDraftSection({
  proposalId,
  proposalNumber,
}: DeleteDraftSectionProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deleteDraftProposal, initialState);

  if (!confirming) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Delete draft</h3>
          <p className="mt-1 text-sm text-muted">
            Remove this draft if you no longer need it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-9 items-center justify-center rounded-full border border-red-500/30 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
        >
          Delete Draft
        </button>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="proposalId" value={proposalId} />

      <h3 className="text-lg font-semibold">Delete this draft?</h3>
      <p className="mt-2 text-sm text-muted">
        This will permanently delete{" "}
        <span className="font-medium text-foreground">{proposalNumber}</span>.
        This cannot be undone.
      </p>

      {state.error ? (
        <div className="mt-4">
          <AuthError message={state.error} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex h-9 items-center justify-center rounded-full border border-border-subtle bg-white/5 px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
        >
          Cancel
        </button>
        <ConfirmDeleteButton />
      </div>
    </form>
  );
}
