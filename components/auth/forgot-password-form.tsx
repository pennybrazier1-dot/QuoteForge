"use client";

import { useActionState } from "react";
import {
  requestPasswordReset,
  type AuthActionState,
} from "@/app/auth/actions";
import { AuthError, AuthField } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function ForgotPasswordForm({
  defaultEmail,
}: {
  defaultEmail?: string;
}) {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <AuthError message={state.error} /> : null}

      {state.success ? (
        <p
          role="status"
          className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          {state.success}
        </p>
      ) : null}

      <AuthField
        key={defaultEmail ?? "email"}
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={defaultEmail}
      />

      <AuthSubmitButton
        label="Send reset link"
        pendingLabel="Sending…"
      />
    </form>
  );
}
