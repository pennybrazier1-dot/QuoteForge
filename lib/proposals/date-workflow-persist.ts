import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureJobForAcceptedProposal } from "@/lib/jobs/create-job-from-proposal";
import { syncJobStatusForProposal } from "@/lib/jobs/sync-job-status";
import {
  buildCustomerConversationUrl,
  notifyConversationParticipant,
} from "@/lib/proposals/customer-portal/conversation-notify";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  buildDateWorkflowSnapshot,
  isBookedJob,
  type DateSlotState,
} from "@/lib/proposals/date-workflow";
import { plannedStartToDbFields } from "@/lib/proposals/planned-start-date";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";
import { classifyChangeRequestLabels } from "@/lib/proposals/change-request/analyze-change-request";
import { buildScheduleDateLabel } from "@/lib/proposals/schedule/schedule-fields";

export type DateWorkflowProposalRow = {
  id: string;
  workspace_id: string;
  status: string;
  accepted_at?: string | null;
  booking_confirmation?: string | null;
  planned_start_date?: string | null;
  planned_start_time?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  job_address?: string | null;
  materials?: unknown;
  customer_access_token?: string | null;
  proposal_number?: string | null;
};

export function hasOtherUnresolvedWorkRequests(
  messages: ProposalCustomerMessage[]
): boolean {
  return messages.some((message) => {
    if (message.direction === "trader" || message.kind === "trader_reply") {
      return false;
    }
    if (message.kind === "accept_note") {
      return false;
    }
    const labels = classifyChangeRequestLabels(message.body);
    return (
      labels.includes("scope") ||
      labels.includes("materials") ||
      labels.includes("price")
    );
  });
}

export async function promoteBookedJobIfReady(
  supabase: SupabaseClient,
  proposal: DateWorkflowProposalRow,
  options?: { acceptedAt?: string; userId?: string | null }
): Promise<{ promoted: boolean; jobId?: string }> {
  const snapshot = buildDateWorkflowSnapshot({
    status: proposal.status,
    acceptedAt: proposal.accepted_at,
    bookingConfirmation: proposal.booking_confirmation,
    plannedStartDate: proposal.planned_start_date,
    plannedStartTime: proposal.planned_start_time,
  });

  if (!isBookedJob(snapshot.proposalAccepted, snapshot.dateState)) {
    return { promoted: false };
  }

  const jobResult = await ensureJobForAcceptedProposal(
    supabase,
    {
      id: proposal.id,
      workspace_id: proposal.workspace_id,
      customer_id: proposal.customer_id ?? null,
      customer_name: proposal.customer_name ?? null,
      customer_email: proposal.customer_email ?? null,
      customer_phone: proposal.customer_phone ?? null,
      customer_address: proposal.customer_address ?? null,
      job_address: proposal.job_address ?? null,
      planned_start_date: proposal.planned_start_date ?? null,
      materials: proposal.materials,
    },
    { acceptedAt: options?.acceptedAt }
  );

  if (!jobResult.ok) {
    return { promoted: false };
  }

  const alreadyScheduled = jobResult.job.status === "scheduled";
  if (!alreadyScheduled) {
    await syncJobStatusForProposal(supabase, proposal.id, "scheduled");
  }

  const now = options?.acceptedAt ?? new Date().toISOString();
  await supabase
    .from("job_prep_items")
    .update({
      status: "confirmed",
      confirmed_at: now,
    })
    .eq("job_id", jobResult.job.id)
    .eq("item_key", "start_date")
    .neq("status", "confirmed");

  if (!alreadyScheduled) {
    await recordProposalEvent(supabase, {
      workspaceId: proposal.workspace_id,
      proposalId: proposal.id,
      userId: options?.userId ?? null,
      eventType: "status_change",
      fromStatus: proposal.status,
      toStatus: "booked",
      note: "Job became booked",
      metadata: {
        source: "date_workflow",
        action: "booked_job_promoted",
        planned_start_date: proposal.planned_start_date ?? null,
        planned_start_time: proposal.planned_start_time ?? null,
      },
    });
  }

  return { promoted: true, jobId: jobResult.job.id };
}

export async function persistProposalDateSlot(
  supabase: SupabaseClient,
  proposal: DateWorkflowProposalRow,
  input: {
    dateIso: string;
    timeHm: string;
    dateText?: string | null;
    nextDateState: DateSlotState;
    nextStatus: string;
    userId?: string | null;
    eventNote: string;
    metadata?: Record<string, unknown>;
    attentionReason?: string | null;
  }
): Promise<{ error?: string }> {
  const plannedFields = plannedStartToDbFields({
    plannedStartDate:
      input.dateText ||
      buildScheduleDateLabel({
        dateIso: input.dateIso,
        time: input.timeHm,
      }),
    plannedStartDateExact: input.dateIso,
  });

  const { error } = await supabase
    .from("proposals")
    .update({
      status: input.nextStatus,
      booking_confirmation:
        input.nextDateState === "none" ? null : input.nextDateState,
      planned_start_time: input.timeHm,
      attention_reason: input.attentionReason ?? null,
      ...plannedFields,
    })
    .eq("id", proposal.id);

  if (error) {
    return { error: error.message || "Could not save this date." };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: input.userId ?? null,
    eventType: "status_change",
    fromStatus: proposal.status,
    toStatus: input.nextStatus,
    note: input.eventNote,
    metadata: {
      source: "date_workflow",
      booking_confirmation:
        input.nextDateState === "none" ? null : input.nextDateState,
      planned_start_time: input.timeHm,
      ...plannedFields,
      ...input.metadata,
    },
  });

  return {};
}

export async function releaseProposalDateHold(
  supabase: SupabaseClient,
  proposal: DateWorkflowProposalRow,
  input: {
    nextStatus: string;
    userId?: string | null;
    eventNote: string;
    attentionReason: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("proposals")
    .update({
      status: input.nextStatus,
      booking_confirmation: null,
      planned_start_date: null,
      planned_start_date_text: null,
      planned_start_time: null,
      attention_reason: input.attentionReason,
    })
    .eq("id", proposal.id);

  if (error) {
    return { error: error.message || "Could not release this hold." };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: input.userId ?? null,
    eventType: "status_change",
    fromStatus: proposal.status,
    toStatus: input.nextStatus,
    note: input.eventNote,
    metadata: {
      source: "date_workflow",
      action: "release_hold",
      ...input.metadata,
    },
  });

  return {};
}

export async function notifyCustomerProposedDate(
  supabase: SupabaseClient,
  proposal: DateWorkflowProposalRow,
  slotLabel: string
): Promise<void> {
  const token = proposal.customer_access_token?.trim();
  const email = proposal.customer_email?.trim();
  if (!token || !email) {
    return;
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("business_name, contact_email")
    .eq("id", proposal.workspace_id)
    .maybeSingle();

  const businessName = resolveCustomerFacingBusinessName(
    workspace?.business_name
  );

  await notifyConversationParticipant({
    to: email,
    subject: `${businessName} proposed a booking date`,
    message: [
      `Hi${proposal.customer_name ? ` ${proposal.customer_name}` : ""},`,
      "",
      `${businessName} has proposed this date:`,
      slotLabel,
      "",
      "Open your proposal link to accept the proposal and this date, or request another one.",
    ].join("\n"),
    businessName,
    ctaUrl: buildCustomerConversationUrl(token),
    ctaLabel: "Confirm date",
    replyTo: workspace?.contact_email,
  });
}
