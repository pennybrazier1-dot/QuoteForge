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

  if (visitId?.trim()) {
    const visit = await getVisit(
      context.supabase,
      context.workspaceId,
      visitId.trim()
    );
    if (!visit) {
      redirect("/proposals/new");
    }

    return (
      <QuotePreparationEntry
        visitId={visit.id}
        visitInitialValues={buildProposalInitialValuesFromVisit(visit)}
        customers={customers}
      />
    );
  }

  return (
    <QuotePreparationEntry enquiryId={enquiryId} customers={customers} />
  );
}
