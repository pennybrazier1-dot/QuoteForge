import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InvoicePrepareRecovery } from "@/components/invoices/invoice-prepare-recovery";
import { InvoiceReviewScreen } from "@/components/invoices/invoice-review-screen";
import {
  ensureInvoiceDraftForJob,
  loadInvoiceForProposal,
} from "@/lib/invoices/ensure-draft";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Review invoice",
  description: "Review and approve the invoice draft for this job.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    redirect("/onboarding");
  }

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("id, proposal_number, status, workspace_id, customer_name, title")
    .eq("id", id)
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle();

  if (error || !proposal) {
    notFound();
  }

  const status = normalizeProposalStatus(proposal.status);
  if (
    status !== "completed" &&
    status !== "closed" &&
    status !== "invoiced" &&
    status !== "paid"
  ) {
    redirect(`/proposals/${proposal.id}`);
  }

  let invoice = await loadInvoiceForProposal(
    supabase,
    proposal.id,
    profile.workspace_id
  );

  if (!invoice && status === "completed") {
    const ensured = await ensureInvoiceDraftForJob(supabase, {
      proposalId: proposal.id,
      workspaceId: profile.workspace_id,
      userId: user.id,
    });
    if (ensured.ok) {
      invoice = ensured.invoice;
    }
  }

  if (!invoice) {
    return (
      <main className="qf-trader-page qf-invoice-page">
        <InvoicePrepareRecovery
          proposalId={proposal.id}
          customerName={proposal.customer_name}
          jobTitle={proposal.title}
        />
      </main>
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("vat_number")
    .eq("id", profile.workspace_id)
    .maybeSingle();

  return (
    <main className="qf-trader-page qf-invoice-page">
      <InvoiceReviewScreen
        key={`${invoice.id}-${invoice.updated_at}-${invoice.status}`}
        invoice={invoice}
        proposalNumber={proposal.proposal_number}
        businessVatNumber={workspace?.vat_number ?? null}
      />
    </main>
  );
}
