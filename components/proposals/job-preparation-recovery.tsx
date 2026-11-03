"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AuthError } from "@/components/auth/auth-shell";
import {
  recoverAcceptedJobPreparation,
  type LifecycleActionState,
} from "@/app/proposals/lifecycle-actions";

const initialState: LifecycleActionState = {};

function RecoverButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Finishing…" : "Finish job setup"}
    </button>
  );
}

/**
 * Shown when acceptance is already recorded but the job row / prep checklist
 * was never created. Retries ensureJob — does not re-accept the quote.
 */
export function JobPreparationRecovery({
  proposalId,
  expectedContentRevision,
  acceptedTotalLabel,
}: {
  proposalId: string;
  expectedContentRevision: number;
  acceptedTotalLabel?: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    recoverAcceptedJobPreparation,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div
      id="job-preparation-recovery"
      className="qf-job-prep-banner"
      role="alert"
    >
      <p className="qf-job-prep-banner-title">Job setup incomplete</p>
      <p className="qf-job-prep-banner-copy">
        This proposal is accepted
        {acceptedTotalLabel ? ` at ${acceptedTotalLabel}` : null}. The job
        checklist was not finished. You do not need to accept again — finish
        setup below.
      </p>
      {state.error ? <AuthError message={state.error} /> : null}
      <form action={action} className="qf-job-prep-recovery-actions">
        <input type="hidden" name="proposalId" value={proposalId} />
        <input
          type="hidden"
          name="expectedContentRevision"
          value={String(expectedContentRevision)}
        />
        <RecoverButton />
      </form>
    </div>
  );
}
