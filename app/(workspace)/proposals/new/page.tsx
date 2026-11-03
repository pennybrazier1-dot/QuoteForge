import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuotePreparationEntry } from "@/components/proposals/quote-preparation-entry";
import { loadCustomersForNameMatch } from "@/lib/customers/load-name-match";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import { getVisit } from "@/lib/visits/queries";
import { buildProposalInitialValuesFromVisit } from "@/lib/visits/quote-handoff";

export const metadata: Metadata = {
  title: "New Quote",
  description:
    "Create a quick quote from a call, visit, message, or referral.",
};

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ enquiryId?: string; visitId?: string }>;
}) {
  const { enquiryId, visitId } = await searchParams;
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    redirect("/login");
  }

  const customers = await loadCustomersForNameMatch(
    context.supabase,
    context.workspaceId
  );

  const trimmedVisitId = visitId?.trim() || "";
  const trimmedEnquiryId = enquiryId?.trim() || "";

  if (trimmedVisitId) {
    const visit = await getVisit(
      context.supabase,
      context.workspaceId,
      trimmedVisitId
    );
    if (!visit) {
      redirect("/proposals/new");
    }

    const visitEnquiryId = visit.enquiry_id?.trim() || "";

    // Reject mismatched enquiryId query vs the visit's linked enquiry.
    if (
      trimmedEnquiryId &&
      visitEnquiryId &&
      trimmedEnquiryId !== visitEnquiryId
    ) {
      redirect(
        `/proposals/new?enquiryId=${encodeURIComponent(visitEnquiryId)}&visitId=${encodeURIComponent(visit.id)}`
      );
    }

    // Linked booking → Prepare Quote with that visit's capture only.
    if (visitEnquiryId) {
      return (
        <QuotePreparationEntry
          enquiryId={visitEnquiryId}
          visitId={visit.id}
          customers={customers}
        />
      );
    }

    // Calendar-only visit (no enquiry): keep Quick Quote from visit notes.
    return (
      <QuotePreparationEntry
        visitId={visit.id}
        visitInitialValues={buildProposalInitialValuesFromVisit(visit)}
        customers={customers}
      />
    );
  }

  return (
    <QuotePreparationEntry enquiryId={trimmedEnquiryId || undefined} customers={customers} />
  );
}
