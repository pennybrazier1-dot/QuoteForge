import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { confirmLinkErrorMessage } from "@/lib/auth/confirm-link";

export const metadata: Metadata = {
  title: "Email verification failed",
  description: "Your Reanvil verification link could not be confirmed.",
};

type ConfirmErrorPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function ConfirmErrorPage({
  searchParams,
}: ConfirmErrorPageProps) {
  const { reason } = await searchParams;
  const message = confirmLinkErrorMessage(reason);

  return (
    <AuthShell
      title="Verification link problem"
      subtitle={message}
      footer={
        <>
          <Link
            href="/forgot-password"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Reset password
          </Link>
          {" · "}
          <Link
            href="/signup"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Sign up
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
      <div className="space-y-3 text-sm text-muted">
        <p>
          Open the newest email from Reanvil. For account signup, request
          another verification email from the check-email screen. For password
          reset, request a new link from forgot password.
        </p>
      </div>
    </AuthShell>
  );
}
