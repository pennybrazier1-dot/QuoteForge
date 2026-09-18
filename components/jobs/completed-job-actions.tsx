"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  reopenCompletedJob,
  type LifecycleActionState,
} from "@/app/proposals/lifecycle-actions";
import { AuthError } from "@/components/auth/auth-shell";

const initialState: LifecycleActionState = {};

function ReopenSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Reopening…" : "Reopen Job"}
    </button>
  );
}

export function CompletedJobActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, action] = useActionState(reopenCompletedJob, initialState);
  const showDialog = confirmOpen && !state.success;

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <section className="qf-workspace-lifecycle" aria-label="Completed job">
      {state.error ? <AuthError message={state.error} /> : null}
      <div className="qf-workspace-lifecycle-block">
        <div className="qf-workspace-lifecycle-actions">
          <button
            type="button"
            className="qf-btn-secondary"
            onClick={() => setConfirmOpen(true)}
          >
            Reopen Job
          </button>
        </div>
      </div>

      {showDialog ? (
        <div
          className="qf-mgmt-dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-job-title"
        >
          <button
            type="button"
            className="qf-mgmt-dialog-overlay"
            aria-label="Cancel"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="qf-mgmt-dialog-panel">
            <h2 id="reopen-job-title" className="qf-mgmt-dialog-title">
              Reopen this job?
            </h2>
            <p className="qf-mgmt-dialog-description">
              This will move the job back into your active work.
            </p>
            <div className="qf-mgmt-dialog-actions">
              <button
                type="button"
                className="qf-btn-secondary"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <form action={action}>
                <input type="hidden" name="proposalId" value={proposalId} />
                <ReopenSubmitButton />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
