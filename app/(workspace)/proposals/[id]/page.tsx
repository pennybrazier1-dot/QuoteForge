import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalWorkspace } from "@/components/proposals/proposal-workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Proposal — QuoteForge",
  description: "Manage your QuoteForge proposal.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, status, title, job_address, rough_notes, customer_id, customer_name, customer_email, customer_phone, customer_address, total_amount, created_at, updated_at, sent_at, accepted_at, job_summary, scope_of_work, materials, labour_description, estimated_duration, things_to_confirm_items, ai_optional_extras, payment_terms"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !proposal) {
    notFound();
  }

  return <ProposalWorkspace proposal={proposal} />;
}
