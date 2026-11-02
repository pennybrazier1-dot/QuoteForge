import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home/home-screen";
import { buildHomeAttentionItems } from "@/lib/home/home-attention";
import {
  buildHomeSectionGroups,
  type HomeProposal,
} from "@/lib/home/home-data";
import {
  findCompletedJobsMissingInvoices,
  type MissingInvoiceAttentionSource,
} from "@/lib/invoices/missing-invoice-attention";
import type { InvoiceDraftAttentionSource } from "@/lib/invoices/types";
import { createClient } from "@/lib/supabase/server";
import { listVisits } from "@/lib/visits/queries";
import type { VisitRecord } from "@/lib/visits/types";

export const metadata: Metadata = {
  title: "Home",
  description: "What do you need to do today?",
};

const HOME_PROPOSAL_SELECT =
  "id, proposal_number, customer_name, title, job_summary, rough_notes, scope_of_work, job_address, status, attention_reason, booking_confirmation, total_amount, created_at, updated_at, accepted_at, sent_at, booked_at, completed_at, planned_start_date_text, planned_start_date, planned_start_time, estimated_duration";

type PageProps = {
  searchParams: Promise<{
    visitBooked?: string;
    jobCompleted?: string;
    completedCustomer?: string;
    invoiceFailed?: string;
    completedProposal?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select(HOME_PROPOSAL_SELECT)
    .order("updated_at", { ascending: false })
    .limit(100);

  let visits: VisitRecord[] = [];
  let invoiceDrafts: InvoiceDraftAttentionSource[] = [];
  let missingInvoices: MissingInvoiceAttentionSource[] = [];
  if (profile?.workspace_id) {
    visits = await listVisits(supabase, profile.workspace_id, {
      status: "open",
    });
    const { data: draftRows } = await supabase
      .from("invoices")
      .select(
        "id, proposal_id, invoice_number, status, customer_name, job_title, total_amount, balance_due, currency"
      )
      .eq("workspace_id", profile.workspace_id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(50);
    invoiceDrafts = (draftRows ?? []) as InvoiceDraftAttentionSource[];

    // Workspace-scoped: all invoice proposal ids for this trader's business.
    const { data: invoiceLinks } = await supabase
      .from("invoices")
      .select("proposal_id")
      .eq("workspace_id", profile.workspace_id)
      .limit(200);
    const invoiceProposalIds = (invoiceLinks ?? []).map(
      (row) => row.proposal_id as string
    );
    missingInvoices = findCompletedJobsMissingInvoices(
      (proposalsData ?? []) as HomeProposal[],
      invoiceProposalIds
    );
  }

  const proposals = (proposalsData ?? []) as HomeProposal[];
  const groups = buildHomeSectionGroups(
    proposals,
    visits,
    new Date(),
    invoiceDrafts,
    missingInvoices
  );
  const attentionItems = buildHomeAttentionItems(
    proposals,
    new Date(),
    invoiceDrafts,
    missingInvoices
  );
  const {
    visitBooked,
    jobCompleted,
    completedCustomer,
    invoiceFailed,
    completedProposal,
  } = await searchParams;

  return (
    <HomeScreen
      fullName={profile?.full_name ?? null}
      attentionItems={attentionItems}
      groups={groups}
      visitBooked={visitBooked === "1"}
      jobCompleted={jobCompleted === "1"}
      completedCustomer={completedCustomer ?? null}
      invoiceFailed={invoiceFailed === "1"}
      completedProposalId={completedProposal ?? null}
    />
  );
}
