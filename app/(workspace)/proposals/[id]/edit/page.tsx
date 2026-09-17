import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NewProposalForm } from "@/components/proposals/new-proposal-form";
import { loadCustomersForNameMatch } from "@/lib/customers/load-name-match";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import { parseEstimatedDuration } from "@/lib/proposals/duration";
import type { ProposalFormValues } from "@/lib/proposals/form-values";
import { formatPenceForInput } from "@/lib/proposals/money";
import { formatOptionalExtrasForForm } from "@/lib/proposals/optional-extras";
import { parseBookingWindow } from "@/lib/proposals/booking-window";
import { plannedStartFromDb } from "@/lib/proposals/planned-start-date";
import { canEditProposal } from "@/lib/proposals/status";

export const metadata: Metadata = {
  title: "Edit Proposal",
  description: "Edit your Reanvil proposal.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProposalPage({ params }: PageProps) {
  const { id } = await params;
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    redirect("/login");
  }

  const { data: proposal, error } = await context.supabase
    .from("proposals")
    .select(
      "id, status, customer_id, customer_name, customer_email, customer_phone, customer_address, job_address, rough_notes, optional_extras, things_to_confirm, estimated_duration, total_amount, planned_start_date_text, planned_start_date, booking_window"
    )
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
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
    bookingWindow: parseBookingWindow(proposal.booking_window),
  };

  const customers = await loadCustomersForNameMatch(
    context.supabase,
    context.workspaceId
  );

  return (
    <NewProposalForm
      mode="edit"
      proposalId={id}
      proposalStatus={proposal.status}
      initialValues={initialValues}
      customers={customers}
      initialCustomerId={proposal.customer_id ?? ""}
    />
  );
}
