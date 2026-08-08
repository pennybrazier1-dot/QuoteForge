import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuotePreparationEntry } from "@/components/proposals/quote-preparation-entry";
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

  if (visitId?.trim()) {
    const context = await requireWorkspaceContext();
    if (!context.ok) {
      redirect("/login");
    }

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
      />
    );
  }

  return <QuotePreparationEntry enquiryId={enquiryId} />;
}
