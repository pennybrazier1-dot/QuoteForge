"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  simulateSendProposal,
  type DevLifecycleState,
} from "@/app/proposals/dev-lifecycle-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { isDevTestingEnabledClient } from "@/lib/env/dev-testing";
import { normalizeProposalStatus } from "@/lib/proposals/status";

const initialState: DevLifecycleState = {};

function TestMarkAsSentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="qf-dev-test-send-btn"
    >
      {pending ? "Marking as sent…" : "Test: Mark as Sent"}
    </button>
  );
}

type TestMarkAsSentButtonProps = {
  proposalId: string;
  status: string;
  customerEmail: string | null;
};

export function TestMarkAsSentButton({
  proposalId,
  status,
  customerEmail,
}: TestMarkAsSentButtonProps) {
  const [state, formAction] = useActionState(
    simulateSendProposal,
    initialState
  );

  if (!isDevTestingEnabledClient()) {
    return null;
  }

  if (normalizeProposalStatus(status) !== "ready_to_send") {
    return null;
  }

  return (
    <section className="qf-dev-test-send" aria-label="Dev test send">
      <p className="qf-dev-test-send-label">Dev testing — preview/local only</p>
      {state.error ? <AuthError message={state.error} /> : null}
      <form action={formAction}>
        <input type="hidden" name="proposalId" value={proposalId} />
        {customerEmail ? (
          <input type="hidden" name="customerEmail" value={customerEmail} />
        ) : null}
        <TestMarkAsSentSubmitButton />
      </form>
    </section>
  );
}
