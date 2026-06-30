"use client";

import { useActionState } from "react";
import { login, type AuthActionState } from "@/app/auth/actions";
import { AuthError, AuthField } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <AuthError message={state.error} /> : null}

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
        autoComplete="current-password"
      />

      <AuthSubmitButton label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}
