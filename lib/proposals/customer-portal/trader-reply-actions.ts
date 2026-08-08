"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  buildCustomerReplyNotification,
  notifyConversationParticipant,
} from "@/lib/proposals/customer-portal/conversation-notify";
import { buildTraderReplyInsert } from "@/lib/proposals/customer-portal/message-kinds";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type TraderReplyActionState = {
  error?: string;
  ok?: boolean;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Stores a trader reply on the proposal conversation thread and notifies the customer.
 * Does not edit proposal content or send a revised quote.
 */
export async function createTraderProposalReply(
  _prev: TraderReplyActionState,
  formData: FormData
): Promise<TraderReplyActionState> {
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
  const body = getString(formData, "body");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!body) {
    return { error: "Please enter a reply." };
  }

  if (body.length > 4000) {
    return { error: "Please keep your reply under 4,000 characters." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, workspace_id, status, customer_email, customer_name, customer_access_token"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const insert = buildTraderReplyInsert({
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    body,
    userId: user.id,
  });

  const { error: insertError } = await supabase
    .from("proposal_customer_messages")
    .insert(insert);

  if (insertError) {
    return {
      error: insertError.message || "Could not save your reply.",
    };
  }

  const status = normalizeProposalStatus(proposal.status);
  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: status,
    toStatus: status,
    note: `Trader reply: ${body.slice(0, 200)}${body.length > 200 ? "…" : ""}`,
    metadata: {
      source: "trader",
      action: "trader_reply",
      direction: "trader",
    },
  });

  if (proposal.customer_access_token && proposal.customer_email) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("business_name, contact_email")
      .eq("id", proposal.workspace_id)
      .maybeSingle();

    const notification = buildCustomerReplyNotification({
      businessName: workspace?.business_name,
      customerName: proposal.customer_name,
      preview: body,
      portalToken: proposal.customer_access_token,
    });

    await notifyConversationParticipant({
      to: proposal.customer_email,
      ...notification,
      replyTo: workspace?.contact_email,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  if (proposal.customer_access_token) {
    revalidatePath(`/p/${proposal.customer_access_token}`);
  }

  return { ok: true };
}
