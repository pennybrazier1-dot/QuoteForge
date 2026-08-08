import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProposalChangeNotes } from "@/components/proposals/proposal-change-notes";
import { buildConversationResolutionSummary } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Update proposal",
  description: "Write proposal changes from the customer conversation.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalRevisePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: proposal, error }, messages] = await Promise.all([
    supabase
      .from("proposals")
      .select("id, proposal_number")
      .eq("id", id)
      .maybeSingle(),
    loadProposalCustomerMessages(supabase, id),
  ]);

  if (error || !proposal) {
    notFound();
  }

  const summary = buildConversationResolutionSummary(messages);

  return (
    <ProposalChangeNotes
      proposalId={proposal.id}
      proposalNumber={proposal.proposal_number}
      summary={summary}
    />
  );
}
