import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { VisitDetailView } from "@/components/visits/visit-detail-view";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import { getVisit } from "@/lib/visits/queries";

export const metadata: Metadata = {
  title: "Visit",
  description: "Visit details and notes.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VisitDetailPage({ params }: PageProps) {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    redirect("/login");
  }

  const { id } = await params;
  const visit = await getVisit(context.supabase, context.workspaceId, id);
  if (!visit) {
    notFound();
  }

  let linkedProposal: { id: string; proposal_number: string | null } | null =
    null;
  if (visit.linked_proposal_id) {
    const { data: proposal } = await context.supabase
      .from("proposals")
      .select("id, proposal_number")
      .eq("id", visit.linked_proposal_id)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();
    linkedProposal = proposal ?? null;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <VisitDetailView visit={visit} linkedProposal={linkedProposal} />
    </main>
  );
}
