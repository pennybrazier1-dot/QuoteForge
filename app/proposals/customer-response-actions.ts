"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  formatAttentionReason,
  isAttentionReason,
} from "@/lib/proposals/attention";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type CustomerResponseState = {
  error?: string;
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

export async function recordCustomerAttention(
  _prevState: CustomerResponseState,
  formData: FormData
): Promise<CustomerResponseState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = getString(formData, "proposalId");
  const attentionReason = getString(formData, "attentionReason");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!isAttentionReason(attentionReason)) {
    return { error: "Choose what the customer needs." };
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
    return { error: "Only quotes awaiting a customer reply can move here." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "needs_attention",
      attention_reason: attentionReason,
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not update this proposal.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "needs_attention",
    note: formatAttentionReason(attentionReason),
    metadata: { attention_reason: attentionReason },
  });

  revalidateAll(proposalId);
  redirect(`/proposals/${proposalId}`);
}

export async function recordCustomerDecline(
  _prevState: CustomerResponseState,
  formData: FormData
): Promise<CustomerResponseState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = getString(formData, "proposalId");

  if (!proposalId) {
    return { error: "Proposal not found." };
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

  if (
    currentStatus !== "waiting_for_customer" &&
    currentStatus !== "needs_attention"
  ) {
    return { error: "This proposal cannot be declined from its current status." };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "cancelled",
      attention_reason: null,
    })
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not cancel this proposal.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: "cancelled",
    note: "Customer declined",
  });

  revalidateAll(proposalId);
  redirect("/dashboard");
}
