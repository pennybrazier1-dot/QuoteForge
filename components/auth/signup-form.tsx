"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signup, type AuthActionState } from "@/app/auth/actions";
import { AuthError, AuthField } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signup, initialState);
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email")?.trim() || undefined;

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <AuthError message={state.error} /> : null}

      <AuthField
        label="Name"
        id="fullName"
        name="fullName"
        type="text"
        autoComplete="name"
      />
      <AuthField
        key={emailFromQuery ?? "email"}
        label="Email"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={emailFromQuery}
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
