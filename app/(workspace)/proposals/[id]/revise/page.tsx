import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProposalRevisionReview } from "@/components/proposals/revision/proposal-revision-review";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import { buildProposalRevisionReviewModel } from "@/lib/proposals/revision/build-revision-review-model";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Review proposal changes",
  description: "Review suggested proposal changes from the conversation.",
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
        "id, proposal_number, title, customer_name, total_amount, estimated_duration, planned_start_date_text, planned_start_date, job_summary, scope_of_work, materials, labour_description, things_to_confirm_items, ai_optional_extras, payment_terms, rough_notes"
      )
      .eq("id", id)
      .maybeSingle(),
    loadProposalCustomerMessages(supabase, id),
  ]);

  if (error || !proposal) {
    notFound();
  }

  const model = buildProposalRevisionReviewModel(proposal, messages);

  return <ProposalRevisionReview model={model} messages={messages} />;
}
