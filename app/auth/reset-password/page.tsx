import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { confirmLinkErrorMessage } from "@/lib/auth/confirm-link";
import { establishSessionFromLinkParams } from "@/lib/auth/establish-session-from-link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your Reanvil account.",
};

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const single = firstParam(value);
    if (single) {
      query.set(key, single);
    }
  }

  const supabase = await createClient();
  const hasLinkParams = Boolean(
    query.get("token_hash") || query.get("code") || query.get("type")
  );

  if (hasLinkParams) {
    const result = await establishSessionFromLinkParams(supabase, query);
    if (!result.ok) {
      redirect(`/auth/confirm/error?reason=${result.reason}`);
    }
    // Drop one-time tokens from the URL after the session cookie is set.
    redirect("/auth/reset-password");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell
        title="Reset link problem"
        subtitle={confirmLinkErrorMessage("missing")}
        footer={
          <>
            <Link
              href="/forgot-password"
              className="font-medium text-accent hover:text-accent-hover"
            >
              Request a new reset link
            </Link>
            {" · "}
            <Link
              href="/login"
              className="font-medium text-accent hover:text-accent-hover"
            >
              Sign in
            </Link>
          </>
        }
      >
        <p className="text-sm text-muted">
          Open the newest password reset email from Reanvil, or request another
          link from the forgot password page.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter a new password for your Reanvil account."
      footer={
        <>
          <Link
            href="/login"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
