import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProposalWorkspace } from "@/components/proposals/proposal-workspace";
import type { ProposalStatusEventRecord } from "@/lib/proposals/proposal-status-events";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: proposal, error }, { data: workspace }, { data: statusEvents }] =
    await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, proposal_number, status, title, job_address, rough_notes, customer_id, customer_name, customer_email, customer_phone, customer_address, total_amount, created_at, updated_at, sent_at, accepted_at, job_summary, scope_of_work, materials, labour_description, estimated_duration, things_to_confirm_items, ai_optional_extras, payment_terms"
      )
      .eq("id", id)
      .maybeSingle(),
    profile?.workspace_id
      ? supabase
          .from("workspaces")
          .select("business_name")
          .eq("id", profile.workspace_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("proposal_status_events")
      .select(
        "id, event_type, from_status, to_status, note, metadata, created_at"
      )
      .eq("proposal_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !proposal) {
    notFound();
  }

  return (
    <ProposalWorkspace
      proposal={proposal}
      businessName={workspace?.business_name ?? "Your business"}
      senderName={profile?.full_name ?? "Your team"}
      statusEvents={(statusEvents ?? []) as ProposalStatusEventRecord[]}
    />
  );
}
