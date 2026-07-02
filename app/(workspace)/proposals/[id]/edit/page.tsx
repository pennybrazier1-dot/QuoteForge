import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NewProposalForm } from "@/components/proposals/new-proposal-form";
import { parseEstimatedDuration } from "@/lib/proposals/duration";
import type { ProposalFormValues } from "@/lib/proposals/form-values";
import { formatPenceForInput } from "@/lib/proposals/money";
import { formatOptionalExtrasForForm } from "@/lib/proposals/optional-extras";
import { plannedStartFromDb } from "@/lib/proposals/planned-start-date";
import { canEditProposal } from "@/lib/proposals/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit Proposal — QuoteForge",
  description: "Edit your QuoteForge proposal.",
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
      "id, status, customer_name, customer_email, customer_phone, customer_address, job_address, rough_notes, optional_extras, things_to_confirm, estimated_duration, total_amount, planned_start_date_text, planned_start_date"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !proposal) {
    notFound();
  }

  if (!canEditProposal(proposal.status)) {
    redirect(`/proposals/${id}`);
  }

  const plannedStart = plannedStartFromDb(proposal);

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
    plannedStartDateText: plannedStart.plannedStartDate,
    plannedStartDateExact: plannedStart.plannedStartDateExact,
  };

  return (
    <NewProposalForm
      mode="edit"
      proposalId={id}
      proposalStatus={proposal.status}
      initialValues={initialValues}
    />
  );
}
