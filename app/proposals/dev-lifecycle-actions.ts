"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  devTestingDisabledMessage,
  isDevTestingEnabled,
} from "@/lib/env/dev-testing";
import { userHasProfile } from "@/lib/onboarding/status";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { executeSimulatedSend } from "@/lib/proposals/simulated-send";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type DevLifecycleState = {
  error?: string;
  success?: boolean;
  simulated?: boolean;
  message?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateAll(proposalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
}

function assertDevTesting(): DevLifecycleState | null {
  if (!isDevTestingEnabled()) {
    return { error: devTestingDisabledMessage() };
  }

  return null;
}

export async function simulateSendProposal(
  _prevState: DevLifecycleState,
  formData: FormData
): Promise<DevLifecycleState> {
  console.log("[QuoteForge] simulateSendProposal called");

  const guard = assertDevTesting();

  if (guard) {
    return guard;
  }

  const proposalId = getString(formData, "proposalId");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  const supabase = await createClient();
  const result = await executeSimulatedSend(supabase, formData);

  if (result.error) {
    return { error: result.error };
  }

  redirect(`/proposals/${proposalId}?testSent=1`);
}

async function simulateCustomerAttention(
  proposalId: string,
  attentionReason:
    | "customer_question"
    | "customer_requested_changes"
    | "customer_requested_date_change"
): Promise<DevLifecycleState> {
  const guard = assertDevTesting();

  if (guard) {
    return guard;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, workspace_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (currentStatus !== "waiting_for_customer") {
    return { error: "Only quotes awaiting a customer reply can be simulated." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "needs_attention",
      attention_reason: attentionReason,
    })
    .eq("id", proposalId);

  if (updateError) {
    return { error: updateError.message ?? "Could not simulate customer response." };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "needs_attention",
    note: `Simulated customer response: ${attentionReason}`,
    metadata: { attention_reason: attentionReason, simulated: true },
  });

  revalidateAll(proposalId);
  redirect(`/proposals/${proposalId}`);
}

export async function simulateCustomerAccepted(
  _prevState: DevLifecycleState,
  formData: FormData
): Promise<DevLifecycleState> {
  const guard = assertDevTesting();

  if (guard) {
    return guard;
  }

  const proposalId = getString(formData, "proposalId");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  if (normalizeProposalStatus(proposal.status) !== "waiting_for_customer") {
    return { error: "Only quotes awaiting a customer reply can be simulated." };
  }

  redirect(`/proposals/${proposalId}?openAccept=1`);
}

export async function simulateCustomerAskedQuestion(
  _prevState: DevLifecycleState,
  formData: FormData
): Promise<DevLifecycleState> {
  const proposalId = getString(formData, "proposalId");

  return simulateCustomerAttention(proposalId, "customer_question");
}

export async function simulateCustomerRequestedChanges(
  _prevState: DevLifecycleState,
  formData: FormData
): Promise<DevLifecycleState> {
  const proposalId = getString(formData, "proposalId");

  return simulateCustomerAttention(proposalId, "customer_requested_changes");
}

export async function simulateCustomerDeclined(
  _prevState: DevLifecycleState,
  formData: FormData
): Promise<DevLifecycleState> {
  const guard = assertDevTesting();

  if (guard) {
    return guard;
  }

  const proposalId = getString(formData, "proposalId");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, workspace_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);

  if (currentStatus !== "waiting_for_customer") {
    return { error: "Only quotes awaiting a customer reply can be simulated." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "cancelled",
      attention_reason: null,
    })
    .eq("id", proposalId);

  if (updateError) {
    return { error: updateError.message ?? "Could not simulate customer decline." };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "cancelled",
    note: "Simulated customer declined",
    metadata: { simulated: true },
  });

  revalidateAll(proposalId);
  redirect("/dashboard");
}
