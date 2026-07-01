import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { ProposalsBrowser } from "@/components/proposals/proposals-browser";
import { userHasProfile } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Proposals — QuoteForge",
  description: "Browse and manage your QuoteForge proposals.",
};

export default async function ProposalsPage() {
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

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, customer_name, job_summary, rough_notes, title, status, total_amount, created_at"
    )
    .order("created_at", { ascending: false });

  const proposals = proposalsData ?? [];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardTopBar email={user.email} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Proposals
        </h1>
        <p className="mt-2 text-sm text-muted">
          Browse, search, and manage every proposal in your workspace.
        </p>

        <div className="mt-8">
          <ProposalsBrowser proposals={proposals} />
        </div>
      </main>
    </div>
  );
}
