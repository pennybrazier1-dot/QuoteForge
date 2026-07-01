import type { Metadata } from "next";
import { ProposalsBrowser } from "@/components/proposals/proposals-browser";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Proposals — QuoteForge",
  description: "Browse and manage your QuoteForge proposals.",
};

export default async function ProposalsPage() {
  const supabase = await createClient();

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, customer_name, job_summary, rough_notes, title, status, total_amount, created_at"
    )
    .order("created_at", { ascending: false });

  const proposals = proposalsData ?? [];

  return (
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
  );
}
