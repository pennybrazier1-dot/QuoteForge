import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Reanvil account and start quoting faster.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Reanvil and turn job details into professional quotes in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
