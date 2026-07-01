import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NewProposalForm } from "@/components/proposals/new-proposal-form";
import { parseEstimatedDuration } from "@/lib/proposals/duration";
import type { ProposalFormValues } from "@/lib/proposals/form-values";
import { formatPenceForInput } from "@/lib/proposals/money";
import { formatOptionalExtrasForForm } from "@/lib/proposals/optional-extras";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit Draft Proposal — QuoteForge",
  description: "Edit your draft QuoteForge proposal.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProposalPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(
      "id, status, customer_name, customer_email, customer_phone, customer_address, job_address, rough_notes, optional_extras, things_to_confirm, estimated_duration, total_amount"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !proposal) {
    notFound();
  }

  if (proposal.status !== "draft") {
    redirect(`/proposals/${id}`);
  }

  const initialValues: ProposalFormValues = {
    customerName: proposal.customer_name ?? "",
    propertyAddress:
      proposal.customer_address ?? proposal.job_address ?? "",
    phoneNumber: proposal.customer_phone ?? "",
    emailAddress: proposal.customer_email ?? "",
    jobDescription: proposal.rough_notes ?? "",
    optionalExtras: formatOptionalExtrasForForm(proposal.optional_extras),
    estimatedPrice: formatPenceForInput(proposal.total_amount),
    estimatedDuration: parseEstimatedDuration(
      proposal.estimated_duration,
      proposal.things_to_confirm
    ),
  };

  return (
    <NewProposalForm
      mode="edit"
      proposalId={id}
      initialValues={initialValues}
    />
  );
}
