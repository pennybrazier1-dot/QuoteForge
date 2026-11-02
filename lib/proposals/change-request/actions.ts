"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { recordProposalEvent } from "@/lib/proposals/record-proposal-event";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type ChangeRequestActionState = {
  error?: string;
  ok?: boolean;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Clears change-request attention without editing or resending the proposal.
 */
export async function markChangeRequestResolved(
  _prev: ChangeRequestActionState,
  formData: FormData
): Promise<ChangeRequestActionState> {
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
    .select("id, status, workspace_id, attention_reason")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const currentStatus = normalizeProposalStatus(proposal.status);
  const bookedPendingDateChange =
    currentStatus === "booked" &&
    proposal.attention_reason === "customer_requested_date_change";
  if (currentStatus !== "needs_attention" && !bookedPendingDateChange) {
    return {
      error: "Only open customer requests can be marked resolved.",
    };
  }

  // Booked jobs keep their status; clear attention only.
  const nextStatus = bookedPendingDateChange
    ? "booked"
    : "waiting_for_customer";
  const { error: updateError } = await supabase
    .from("proposals")
    .update(
      bookedPendingDateChange
        ? { attention_reason: null, pending_date_suggestion: null }
        : {
            status: nextStatus,
            attention_reason: null,
            pending_date_suggestion: null,
          }
    )
    .eq("id", proposalId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not mark this request resolved.",
    };
  }

  await recordProposalEvent(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    userId: user.id,
    eventType: "status_change",
    fromStatus: currentStatus,
    toStatus: nextStatus,
    note: "Change request marked resolved",
    metadata: {
      source: "trader",
      action: "mark_change_request_resolved",
    },
  });

  revalidatePath(`/proposals/${proposalId}`);
  return { ok: true };
}
