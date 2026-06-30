import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { ProposalStudioForm } from "@/components/proposals/proposal-studio-form";
import { userHasProfile } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New Proposal — QuoteForge",
  description: "Create a new proposal in QuoteForge.",
};

export default async function NewProposalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userHasProfile(user.id))) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardTopBar email={user.email} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Dashboard
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          New Proposal
        </h1>

        <div className="mt-8">
          <ProposalStudioForm />
        </div>
      </main>
    </div>
  );
}
