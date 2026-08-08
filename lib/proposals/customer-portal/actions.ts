"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatAttentionReason } from "@/lib/proposals/attention";
import { loadPublicProposalByToken } from "@/lib/proposals/customer-portal/load-public-proposal";
import { ensureJobForAcceptedProposal } from "@/lib/jobs/create-job-from-proposal";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type CustomerPortalActionState = {
  ok?: boolean;
  error?: string;
  result?: "accepted" | "question" | "changes";
};

function createPortalClient() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function revalidateTraderViews(proposalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
}

export async function acceptPublicProposal(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const note = getString(formData, "note");

  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (!loaded.view.canRespond || loaded.view.isAccepted || loaded.view.isClosed) {
    return { error: "This proposal can no longer be accepted." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const fromStatus = normalizeProposalStatus(loaded.proposal.status);
  const acceptedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "booked",
      booking_confirmation: "provisional",
      accepted_at: acceptedAt,
      booked_at: acceptedAt,
      attention_reason: null,
    })
    .eq("id", loaded.proposal.id)
    .in("status", ["waiting_for_customer", "needs_attention"]);

  if (updateError) {
    return { error: updateError.message || "Could not accept this proposal." };
  }

  if (note) {
    await supabase.from("proposal_customer_messages").insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      kind: "accept_note",
      direction: "customer",
      body: note,
      created_by: null,
    });
  }

  await supabase.from("proposal_status_events").insert({
    workspace_id: loaded.workspaceId,
    proposal_id: loaded.proposal.id,
    event_type: "status_change",
    from_status: fromStatus,
    to_status: "booked",
    note: note
      ? `Customer accepted the proposal: ${note}`
      : "Customer accepted the proposal",
    metadata: {
      source: "customer_portal",
      action: "accept",
      has_note: Boolean(note),
    },
    created_by: null,
    created_at: acceptedAt,
  });

  const jobResult = await ensureJobForAcceptedProposal(
    supabase,
    {
      id: loaded.proposal.id,
      workspace_id: loaded.workspaceId,
      customer_id: loaded.proposal.customer_id ?? null,
      customer_name: loaded.proposal.customer_name ?? null,
      customer_email: loaded.proposal.customer_email ?? null,
      customer_phone: loaded.proposal.customer_phone ?? null,
      customer_address: loaded.proposal.customer_address ?? null,
      job_address: loaded.proposal.job_address ?? null,
      planned_start_date: loaded.proposal.planned_start_date ?? null,
      materials: loaded.proposal.materials,
    },
    { acceptedAt }
  );

  if (!jobResult.ok) {
    return {
      error:
        jobResult.error ||
        "Proposal was accepted, but the job could not be created.",
    };
  }

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);

  return { ok: true, result: "accepted" };
}

export async function askPublicProposalQuestion(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  return submitAttentionMessage(formData, "question", "customer_question");
}

export async function requestPublicProposalChanges(
  _prev: CustomerPortalActionState,
  formData: FormData
): Promise<CustomerPortalActionState> {
  return submitAttentionMessage(
    formData,
    "change_request",
    "customer_requested_changes"
  );
}

async function submitAttentionMessage(
  formData: FormData,
  kind: "question" | "change_request",
  attentionReason: "customer_question" | "customer_requested_changes"
): Promise<CustomerPortalActionState> {
  const token = getString(formData, "token");
  const message = getString(formData, "message");

  if (!message) {
    return { error: "Please enter a message." };
  }

  if (message.length > 4000) {
    return { error: "Please keep your message under 4,000 characters." };
  }

  const loaded = await loadPublicProposalByToken(token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (!loaded.view.canRespond || loaded.view.isClosed) {
    return { error: "This proposal is no longer open for replies." };
  }

  const supabase = createPortalClient();
  if (!supabase) {
    return { error: "The proposal portal is not configured yet." };
  }

  const fromStatus = normalizeProposalStatus(loaded.proposal.status);

  const { error: messageError } = await supabase
    .from("proposal_customer_messages")
    .insert({
      workspace_id: loaded.workspaceId,
      proposal_id: loaded.proposal.id,
      kind,
      direction: "customer",
      body: message,
      created_by: null,
    });

  if (messageError) {
    return { error: messageError.message || "Could not send your message." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "needs_attention",
      attention_reason: attentionReason,
    })
    .eq("id", loaded.proposal.id)
    .in("status", ["waiting_for_customer", "needs_attention"]);

  if (updateError) {
    return { error: updateError.message || "Could not update this proposal." };
  }

  await supabase.from("proposal_status_events").insert({
    workspace_id: loaded.workspaceId,
    proposal_id: loaded.proposal.id,
    event_type: "status_change",
    from_status: fromStatus,
    to_status: "needs_attention",
    note: `${formatAttentionReason(attentionReason)}: ${message}`,
    metadata: {
      source: "customer_portal",
      action: kind,
      attention_reason: attentionReason,
    },
    created_by: null,
  });

  await revalidateTraderViews(loaded.proposal.id);
  revalidatePath(`/p/${token}`);

  return {
    ok: true,
    result: kind === "question" ? "question" : "changes",
  };
}
