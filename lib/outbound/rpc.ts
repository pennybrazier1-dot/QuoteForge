import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EnqueueOutboundInput,
  OutboundRpcResult,
  OutboundStatus,
} from "@/lib/outbound/types";

function asRpcResult(data: unknown): OutboundRpcResult {
  if (!data || typeof data !== "object") {
    return { ok: false, reason: "Unexpected outbound RPC response." };
  }
  return data as OutboundRpcResult;
}

export async function enqueueOutboundMessage(
  supabase: SupabaseClient,
  input: EnqueueOutboundInput
): Promise<OutboundRpcResult> {
  const { data, error } = await supabase.rpc("enqueue_outbound_message", {
    p_workspace_id: input.workspaceId,
    p_event_kind: input.eventKind,
    p_audience: input.audience,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_recipient_email: input.recipientEmail,
    p_idempotency_key: input.idempotencyKey,
    p_subject: input.subject ?? null,
    p_proposal_id: input.proposalId ?? null,
    p_enquiry_id: input.enquiryId ?? null,
    p_visit_id: input.visitId ?? null,
    p_invoice_id: input.invoiceId ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    return { ok: false, reason: error.message || "Could not enqueue notification." };
  }
  return asRpcResult(data);
}

export async function claimOutboundMessage(
  supabase: SupabaseClient,
  messageId: string
): Promise<OutboundRpcResult> {
  const { data, error } = await supabase.rpc("claim_outbound_message", {
    p_message_id: messageId,
  });
  if (error) {
    return { ok: false, reason: error.message || "Could not claim notification." };
  }
  return asRpcResult(data);
}

export async function settleOutboundMessage(
  supabase: SupabaseClient,
  input: {
    messageId: string;
    status: Extract<
      OutboundStatus,
      "provider_accepted" | "failed" | "unknown" | "simulated"
    >;
    provider?: "resend" | "simulated" | null;
    providerMessageId?: string | null;
    lastError?: string | null;
  }
): Promise<OutboundRpcResult> {
  const { data, error } = await supabase.rpc("settle_outbound_message", {
    p_message_id: input.messageId,
    p_status: input.status,
    p_provider: input.provider ?? null,
    p_provider_message_id: input.providerMessageId ?? null,
    p_last_error: input.lastError ?? null,
  });
  if (error) {
    return { ok: false, reason: error.message || "Could not settle notification." };
  }
  return asRpcResult(data);
}

export async function confirmOutboundMessageWithoutResend(
  supabase: SupabaseClient,
  messageId: string,
  providerMessageId?: string | null
): Promise<OutboundRpcResult> {
  const { data, error } = await supabase.rpc(
    "confirm_outbound_message_without_resend",
    {
      p_message_id: messageId,
      p_provider_message_id: providerMessageId ?? null,
    }
  );
  if (error) {
    return {
      ok: false,
      reason: error.message || "Could not confirm notification.",
    };
  }
  return asRpcResult(data);
}

export async function reconcileStaleOutboundSending(
  supabase: SupabaseClient,
  staleAfter: string = "15 minutes"
): Promise<OutboundRpcResult> {
  const { data, error } = await supabase.rpc(
    "reconcile_stale_outbound_sending",
    { p_stale_after: staleAfter }
  );
  if (error) {
    return {
      ok: false,
      reason: error.message || "Could not reconcile stale sends.",
    };
  }
  return asRpcResult(data);
}
