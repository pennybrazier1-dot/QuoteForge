import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your Reanvil account password.",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { email } = await searchParams;
  const defaultEmail = email?.trim() || undefined;

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we will send a reset link if an account exists."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm defaultEmail={defaultEmail} />
    </AuthShell>
  );
}
