import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { ProposalDetail } from "@/components/proposals/proposal-detail";
import { userHasProfile } from "@/lib/onboarding/status";
import { getProposalPageTitle } from "@/lib/proposals/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Proposal — QuoteForge",
  description: "View your saved QuoteForge proposal.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalPage({ params }: PageProps) {
  const { id } = await params;
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

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, status, title, job_address, rough_notes, optional_extras, things_to_confirm, customer_name, customer_email, customer_phone, customer_address, total_amount, created_at, job_summary, scope_of_work, materials, labour_description, estimated_duration, things_to_confirm_items, ai_optional_extras, payment_terms"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !proposal) {
    notFound();
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
          {getProposalPageTitle(proposal.status)}
        </h1>

        <div className="mt-8">
          <ProposalDetail proposal={proposal} />
        </div>
      </main>
    </div>
  );
}
