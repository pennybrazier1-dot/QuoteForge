"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/app/auth/actions";
import { AuthError, AuthField } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <AuthError message={state.error} /> : null}

      <AuthField
        label="New password"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
      />
      <AuthField
        label="Confirm new password"
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
      />

      <AuthSubmitButton
        label="Update password"
        pendingLabel="Updating…"
      />
    </form>
  );
}
