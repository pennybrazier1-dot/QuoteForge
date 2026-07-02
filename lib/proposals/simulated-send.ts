import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  devTestingDisabledMessage,
  isDevTestingEnabled,
} from "@/lib/env/dev-testing";
import { userHasProfile } from "@/lib/onboarding/status";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import { SIMULATED_SEND_MESSAGE } from "@/lib/proposals/simulated-send-constants";

export type SimulatedSendResult = {
  success?: boolean;
  simulated?: boolean;
  message?: string;
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

/**
 * Simulated send — updates status and timeline only.
 * Never calls Resend or checks RESEND_API_KEY.
 */
export async function executeSimulatedSend(
  supabase: SupabaseClient,
  formData: FormData
): Promise<SimulatedSendResult> {
  console.log("[QuoteForge] executeSimulatedSend called");

  if (!isDevTestingEnabled()) {
    return { error: devTestingDisabledMessage() };
  }

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
  const customerEmail =
    getString(formData, "customerEmail") || "test@example.com";

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, workspace_id, customer_email")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  if (normalizeProposalStatus(proposal.status) !== "ready_to_send") {
    return {
      error: "Only proposals that are ready to send can be test-sent.",
    };
  }

  const sentAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "waiting_for_customer",
      sent_at: sentAt,
      customer_email: customerEmail,
    })
    .eq("id", proposalId)
    .eq("status", "ready_to_send");

  if (updateError) {
    return {
      error: updateError.message ?? "Could not update this proposal.",
    };
  }

  const { error: eventError } = await supabase.from("proposal_status_events").insert({
    workspace_id: proposal.workspace_id,
    proposal_id: proposalId,
    event_type: "emailed",
    from_status: "ready_to_send",
    to_status: "waiting_for_customer",
    note: `Test send to ${customerEmail} (no email sent)`,
    metadata: {
      recipient_email: customerEmail,
      provider: "simulated",
      simulated: true,
    },
    created_by: user.id,
    created_at: sentAt,
  });

  if (eventError) {
    console.error("Failed to record simulated send event:", eventError);
  }

  revalidateAll(proposalId);

  return {
    success: true,
    simulated: true,
    message: SIMULATED_SEND_MESSAGE,
  };
}
