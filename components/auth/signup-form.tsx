"use client";

import { useActionState } from "react";
import { signup, type AuthActionState } from "@/app/auth/actions";
import { AuthError, AuthField } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <AuthError message={state.error} /> : null}
      {state.success ? (
        <p className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          {state.success}
        </p>
      ) : null}

      <AuthField
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
      />
      <AuthField
        label="Password"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
      />

      <AuthSubmitButton label="Create account" pendingLabel="Creating account…" />
    </form>
  );
}
