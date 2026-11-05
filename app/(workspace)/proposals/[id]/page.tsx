import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  MissingPaymentOutboundReconcile,
  OutboundRecovery,
} from "@/components/outbound/outbound-recovery";
import { ProposalWorkspace } from "@/components/proposals/proposal-workspace";
import { fetchCalendarProposals } from "@/lib/calendar/calendar-queries";
import { loadJobPrepForProposal } from "@/lib/jobs/load-job-for-proposal";
import { findOutboundByIdempotencyKey } from "@/lib/outbound/handoff";
import {
  paymentReceivedLedgerKey,
  paymentRequestedKey,
} from "@/lib/outbound/keys";
import { toOutboundTraderView } from "@/lib/outbound/redact";
import type { OutboundMessageRow, OutboundStatus } from "@/lib/outbound/types";
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
    { data: paymentOutboundRows },
  ] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, workspace_id, proposal_number, status, title, job_address, rough_notes, customer_id, customer_name, customer_email, customer_phone, customer_address, total_amount, created_at, updated_at, sent_at, accepted_at, booked_at, completed_at, attention_reason, booking_confirmation, job_summary, scope_of_work, materials, labour_description, estimated_duration, planned_start_date_text, planned_start_date, planned_start_time, things_to_confirm_items, ai_optional_extras, payment_terms, payment_status, payment_due_amount, payment_methods_issued, payment_request_event_id, paid_at, closed_at, content_revision, unsent_revision_at, issued_content_revision, accepted_content_revision, accepted_total_amount, issue_attempt_at, issue_attempt_provider, issue_attempt_message_id, booking_confirm_status, booking_confirm_attempt_at, booking_confirm_attempt_message_id"
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
    profile?.workspace_id
      ? supabase
          .from("outbound_messages")
          .select(
            "id, workspace_id, event_kind, audience, source_type, source_id, proposal_id, enquiry_id, visit_id, invoice_id, recipient_email, subject, status, provider, provider_message_id, attempt_at, attempt_count, last_error, idempotency_key, metadata, created_at, updated_at"
          )
          .eq("workspace_id", profile.workspace_id)
          .eq("proposal_id", id)
          .in("event_kind", ["payment_requested", "payment_received"])
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
  ]);

  if (error || !proposal) {
    notFound();
  }

  // Workspace ownership: proposal must belong to the trader workspace.
  if (
    profile?.workspace_id &&
    String(proposal.workspace_id) !== String(profile.workspace_id)
  ) {
    notFound();
  }

  const paymentOutbound = (paymentOutboundRows ?? [])
    .filter(
      (row) =>
        row.workspace_id === profile?.workspace_id &&
        (row.event_kind === "payment_requested" ||
          row.event_kind === "payment_received")
    )
    .map((row) => toOutboundTraderView(row as OutboundMessageRow));

  let missingRequest = false;
  let missingReceivedCount = 0;
  const eventId = String(
    (proposal as { payment_request_event_id?: string | null })
      .payment_request_event_id || ""
  ).trim();
  if (
    profile?.workspace_id &&
    eventId &&
    !proposal.closed_at &&
    (proposal.payment_status === "requested" ||
      proposal.payment_status === "partially_paid")
  ) {
    const existingRequest = await findOutboundByIdempotencyKey(
      supabase,
      profile.workspace_id,
      paymentRequestedKey(proposal.id, eventId)
    );
    missingRequest = !existingRequest;
  }

  if (profile?.workspace_id && !proposal.closed_at) {
    const { data: ledgerPayments } = await supabase
      .from("invoice_payments")
      .select("id")
      .eq("workspace_id", profile.workspace_id)
      .eq("proposal_id", proposal.id)
      .eq("is_legacy_marker", false)
      .limit(40);
    for (const payment of ledgerPayments ?? []) {
      const existing = await findOutboundByIdempotencyKey(
        supabase,
        profile.workspace_id,
        paymentReceivedLedgerKey(String(payment.id))
      );
      if (!existing) missingReceivedCount += 1;
    }
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
    <>
      {paymentOutbound.length > 0 ||
      missingRequest ||
      missingReceivedCount > 0 ? (
        <div className="qf-trader-page mx-auto flex w-full max-w-full flex-col gap-3 px-4 pt-4 lg:max-w-6xl lg:px-6">
          <MissingPaymentOutboundReconcile
            proposalId={proposal.id}
            missingRequest={missingRequest}
            missingReceivedCount={missingReceivedCount}
          />
          {paymentOutbound.map((outbound) => (
            <OutboundRecovery
              key={outbound.id}
              outboundMessageId={outbound.id}
              eventKind={outbound.eventKind}
              status={outbound.status as OutboundStatus}
              hasProviderMessageId={outbound.hasProviderMessageId}
              attemptAt={outbound.attemptAt}
              recipientDisplay={outbound.recipientDisplay}
              lastErrorSafe={outbound.lastErrorSafe}
            />
          ))}
        </div>
      ) : null}
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
    </>
  );
}
