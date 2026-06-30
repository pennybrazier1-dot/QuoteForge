import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account — QuoteForge",
  description: "Create your QuoteForge account and start quoting faster.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join QuoteForge and turn job details into professional quotes in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
