import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailPanel } from "@/components/auth/check-email-panel";

export const metadata: Metadata = {
  title: "Check your email",
  description: "Confirm your Reanvil account from the verification email.",
};

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const { email: rawEmail } = await searchParams;
  const email = rawEmail?.trim() ?? "";

  if (!email || !email.includes("@")) {
    redirect("/signup");
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle="Activate your Reanvil account from the verification link we sent."
      footer={
        <>
          Wrong account?{" "}
          <Link
            href="/signup"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Sign up again
          </Link>
        </>
      }
    >
      <CheckEmailPanel email={email} />
    </AuthShell>
  );
}
