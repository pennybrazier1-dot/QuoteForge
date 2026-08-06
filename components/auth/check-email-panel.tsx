"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { resendSignupVerification } from "@/app/auth/actions";
import { AuthError } from "@/components/auth/auth-shell";
import {
  formatResendCooldownLabel,
  nextCooldownEndsAt,
  resendSuccessMessage,
  secondsUntil,
} from "@/lib/auth/resend-verification";

type CheckEmailPanelProps = {
  email: string;
};

export function CheckEmailPanel({ email }: CheckEmailPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!cooldownEndsAt) {
      return;
    }

    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => window.clearInterval(id);
  }, [cooldownEndsAt]);

  const secondsLeft = cooldownEndsAt
    ? secondsUntil(cooldownEndsAt, nowMs)
    : 0;
  const resendDisabled = isPending || secondsLeft > 0;

  function handleResend() {
    setSuccess(null);
    setError(null);

    startTransition(async () => {
      const result = await resendSignupVerification(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(resendSuccessMessage());
      setCooldownEndsAt(nextCooldownEndsAt());
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-accent/90">
          We sent a verification link to{" "}
          <span className="break-all font-semibold">{email}</span>. Click the
          link to activate your Reanvil account.
        </p>
      </div>

      {success ? (
        <p
          role="status"
          className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          {success}
        </p>
      ) : null}

      {error ? <AuthError message={error} /> : null}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendDisabled}
          className="flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Sending…" : formatResendCooldownLabel(secondsLeft)}
        </button>

        <Link
          href={`/signup?email=${encodeURIComponent(email)}`}
          className="flex min-h-11 w-full items-center justify-center rounded-full border border-border-subtle px-4 text-sm font-medium text-foreground transition-colors hover:bg-background-elevated"
        >
          Change email address
        </Link>

        <Link
          href="/login"
          className="flex min-h-11 w-full items-center justify-center rounded-full border border-border-subtle px-4 text-sm font-medium text-muted transition-colors hover:bg-background-elevated hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
