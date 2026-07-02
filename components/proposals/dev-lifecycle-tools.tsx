"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  simulateCustomerAccepted,
  simulateCustomerAskedQuestion,
  simulateCustomerDeclined,
  simulateCustomerRequestedChanges,
  type DevLifecycleState,
} from "@/app/proposals/dev-lifecycle-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { isDevTestingEnabledClient } from "@/lib/env/dev-testing";
import { normalizeProposalStatus } from "@/lib/proposals/status";

const initialState: DevLifecycleState = {};

function DevActionButton({
  label,
  pendingLabel,
  variant = "secondary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const className =
    variant === "primary"
      ? "qf-dev-lifecycle-btn qf-dev-lifecycle-btn-primary"
      : variant === "danger"
        ? "qf-dev-lifecycle-btn qf-dev-lifecycle-btn-danger"
        : "qf-dev-lifecycle-btn";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

type DevLifecycleToolsProps = {
  proposalId: string;
  status: string;
};

export function DevLifecycleTools({ proposalId, status }: DevLifecycleToolsProps) {
  const [acceptedState, acceptedAction] = useActionState(
    simulateCustomerAccepted,
    initialState
  );
  const [questionState, questionAction] = useActionState(
    simulateCustomerAskedQuestion,
    initialState
  );
  const [changesState, changesAction] = useActionState(
    simulateCustomerRequestedChanges,
    initialState
  );
  const [declineState, declineAction] = useActionState(
    simulateCustomerDeclined,
    initialState
  );

  if (!isDevTestingEnabledClient()) {
    return null;
  }

  const normalized = normalizeProposalStatus(status);

  if (normalized !== "waiting_for_customer") {
    return null;
  }

  const error =
    acceptedState.error ||
    questionState.error ||
    changesState.error ||
    declineState.error;

  return (
    <div className="qf-dev-lifecycle-tools">
      <p className="qf-dev-lifecycle-title">Dev testing — simulate customer</p>
      <p className="qf-dev-lifecycle-hint">
        Preview/local only. No real emails or customer portal needed.
      </p>

      {error ? <AuthError message={error} /> : null}

      <div className="qf-dev-lifecycle-actions">
        <form action={acceptedAction} className="w-full">
          <input type="hidden" name="proposalId" value={proposalId} />
          <DevActionButton
            label="Simulate Customer Accepted"
            pendingLabel="Opening…"
            variant="primary"
          />
        </form>

        <form action={questionAction} className="w-full">
          <input type="hidden" name="proposalId" value={proposalId} />
          <DevActionButton
            label="Simulate Customer Asked Question"
            pendingLabel="Simulating…"
          />
        </form>

        <form action={changesAction} className="w-full">
          <input type="hidden" name="proposalId" value={proposalId} />
          <DevActionButton
            label="Simulate Customer Requested Changes"
            pendingLabel="Simulating…"
          />
        </form>

        <form action={declineAction} className="w-full">
          <input type="hidden" name="proposalId" value={proposalId} />
          <DevActionButton
            label="Simulate Customer Declined"
            pendingLabel="Simulating…"
            variant="danger"
          />
        </form>
      </div>
    </div>
  );
}
