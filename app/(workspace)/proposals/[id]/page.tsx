import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProposalWorkspace } from "@/components/proposals/proposal-workspace";
import { fetchCalendarProposals } from "@/lib/calendar/calendar-queries";
import { loadJobPrepForProposal } from "@/lib/jobs/load-job-for-proposal";
import { isConversationDeepLink } from "@/lib/proposals/customer-portal/conversation-deep-link";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import type { ProposalStatusEventRecord } from "@/lib/proposals/proposal-status-events";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";
import { enabledPaymentMethods } from "@/lib/payments/job-payment";
import { emptyPaymentSettings } from "@/lib/payments/settings";
import type { WorkspacePaymentSettings } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Proposal",
  description: "Manage your Reanvil proposal.",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
};

export default async function ProposalPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
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

  const [
    { data: proposal, error },
    { data: workspace },
    { data: statusEvents },
    calendarProposals,
    customerMessages,
    jobPrep,
  ] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, proposal_number, status, title, job_address, rough_notes, customer_id, customer_name, customer_email, customer_phone, customer_address, total_amount, created_at, updated_at, sent_at, accepted_at, booked_at, completed_at, attention_reason, booking_confirmation, job_summary, scope_of_work, materials, labour_description, estimated_duration, planned_start_date_text, planned_start_date, planned_start_time, things_to_confirm_items, ai_optional_extras, payment_terms, payment_status, payment_due_amount, payment_methods_issued, paid_at, closed_at"
      )
      .eq("id", id)
      .maybeSingle(),
    profile?.workspace_id
      ? supabase
          .from("workspaces")
          .select("business_name")
          .eq("id", profile.workspace_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("proposal_status_events")
      .select(
        "id, event_type, from_status, to_status, note, metadata, created_at"
      )
      .eq("proposal_id", id)
      .order("created_at", { ascending: true }),
    fetchCalendarProposals(supabase),
    loadProposalCustomerMessages(supabase, id),
    loadJobPrepForProposal(supabase, id),
  ]);

  if (error || !proposal) {
    notFound();
  }

  let linkedCustomerEmail: string | null = null;
  if (proposal.customer_id) {
    const { data: linkedCustomer } = await supabase
      .from("customers")
      .select("email")
      .eq("id", proposal.customer_id)
      .maybeSingle();
    linkedCustomerEmail = linkedCustomer?.email?.trim() || null;
  }

  const { data: paymentSettings } = profile?.workspace_id
    ? await supabase
        .from("workspace_payment_settings")
        .select(
          "workspace_id, accept_bank_transfer, accept_card_link, accept_card_in_person, accept_cash, accept_other"
        )
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle()
    : { data: null };

  const enabledMethods = enabledPaymentMethods(
    (paymentSettings as Pick<
      WorkspacePaymentSettings,
      | "accept_bank_transfer"
      | "accept_card_link"
      | "accept_card_in_person"
      | "accept_cash"
      | "accept_other"
    > | null) ?? emptyPaymentSettings(profile?.workspace_id ?? "")
  );

  return (
    <ProposalWorkspace
      proposal={{
        ...proposal,
        linked_customer_email: linkedCustomerEmail,
        enabled_payment_methods: enabledMethods,
      }}
      businessName={resolveCustomerFacingBusinessName(
        workspace?.business_name
      )}
      senderName={
        profile?.full_name &&
        !/platform\s+admin/i.test(profile.full_name)
          ? profile.full_name
          : "Your team"
      }
      statusEvents={(statusEvents ?? []) as ProposalStatusEventRecord[]}
      calendarProposals={calendarProposals}
      customerMessages={customerMessages}
      jobPrep={jobPrep}
      openConversation={isConversationDeepLink(query.view)}
    />
  );
}
