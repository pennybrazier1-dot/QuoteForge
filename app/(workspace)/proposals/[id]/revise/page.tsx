import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProposalChangeNotes } from "@/components/proposals/proposal-change-notes";
import { buildConversationResolutionSummary } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";
import { multilineFromLines } from "@/lib/proposals/revision/validate-revision-pricing";
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
      .select(
        "id, proposal_number, status, content_revision, unsent_revision_at, issued_content_revision, scope_of_work, job_summary, materials, labour, labour_description, total_amount, vat_amount, subtotal_amount"
      )
      .eq("id", id)
      .maybeSingle(),
    loadProposalCustomerMessages(supabase, id),
  ]);

  if (error || !proposal) {
    notFound();
  }

  const summary = buildConversationResolutionSummary(messages);
  const { data: latestRevision } = await supabase
    .from("proposal_revisions")
    .select("previous_total_amount, revision_number")
    .eq("proposal_id", proposal.id)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <ProposalChangeNotes
      proposalId={proposal.id}
      proposalNumber={proposal.proposal_number}
      summary={summary}
      current={{
        contentRevision: Number(proposal.content_revision ?? 0),
        scopeOfWork: proposal.scope_of_work ?? "",
        jobSummary: proposal.job_summary ?? "",
        materialsText: multilineFromLines(proposal.materials),
        labourText: multilineFromLines(proposal.labour),
        labourDescription: proposal.labour_description ?? "",
        totalAmountPence: Number(proposal.total_amount ?? 0),
        vatAmountPence: Number(proposal.vat_amount ?? 0),
        unsentRevisionAt: proposal.unsent_revision_at ?? null,
        previousTotalPence:
          latestRevision?.previous_total_amount == null
            ? null
            : Number(latestRevision.previous_total_amount),
        issuedContentRevision:
          proposal.issued_content_revision == null
            ? null
            : Number(proposal.issued_content_revision),
        devTestingEnabled: isDevTestingEnabled(),
      }}
    />
  );
}
