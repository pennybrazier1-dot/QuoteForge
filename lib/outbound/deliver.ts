import type { SupabaseClient } from "@supabase/supabase-js";
import { outboundEmailBlockReason } from "@/lib/email/outbound-guard";
import {
  sendNotificationEmail,
  type SendNotificationEmailInput,
  type SendNotificationEmailResult,
} from "@/lib/email/send-notification-email";
import {
  claimOutboundMessage,
  enqueueOutboundMessage,
  settleOutboundMessage,
} from "@/lib/outbound/rpc";
import { sanitizeOutboundError } from "@/lib/outbound/redact";
import type {
  EnqueueOutboundInput,
  OutboundRpcResult,
} from "@/lib/outbound/types";
import { OUTBOUND_UNKNOWN_REVIEW_COPY } from "@/lib/outbound/types";

export type OutboundEmailPayload = Omit<SendNotificationEmailInput, "to"> & {
  to?: string;
};

export type DeliverOutboundResult = {
  ok: boolean;
  messageId?: string;
  status?: string;
  providerAccepted?: boolean;
  simulated?: boolean;
  unknownOutcome?: boolean;
  error?: string;
  created?: boolean;
};

export type DeliverOutboundDeps = {
  sendEmail?: (
    input: SendNotificationEmailInput
  ) => Promise<SendNotificationEmailResult>;
};

/**
 * Enqueue (idempotent) then claim → send → settle.
 * Business callers should treat email failure as non-fatal.
 */
export async function enqueueAndDeliverOutboundMessage(
  supabase: SupabaseClient,
  input: EnqueueOutboundInput,
  email: OutboundEmailPayload,
  deps: DeliverOutboundDeps = {}
): Promise<DeliverOutboundResult> {
  const enqueued = await enqueueOutboundMessage(supabase, input);
  if (!enqueued.ok || !enqueued.id) {
    return {
      ok: false,
      error: enqueued.reason || "Could not enqueue notification.",
    };
  }

  if (
    enqueued.status === "provider_accepted" ||
    enqueued.status === "simulated"
  ) {
    return {
      ok: true,
      messageId: enqueued.id,
      status: enqueued.status,
      providerAccepted: enqueued.status === "provider_accepted",
      simulated: enqueued.status === "simulated",
      created: enqueued.created,
    };
  }

  if (enqueued.status === "unknown" || enqueued.status === "sending") {
    return {
      ok: false,
      messageId: enqueued.id,
      status: enqueued.status,
      unknownOutcome: true,
      error: OUTBOUND_UNKNOWN_REVIEW_COPY,
      created: enqueued.created,
    };
  }

  const delivered = await deliverOutboundMessage(
    supabase,
    enqueued.id,
    email,
    deps
  );
  return { ...delivered, created: enqueued.created };
}

/**
 * Claim an existing outbound row, call Resend (or fail via local guard), settle.
 */
export async function deliverOutboundMessage(
  supabase: SupabaseClient,
  messageId: string,
  email: OutboundEmailPayload,
  deps: DeliverOutboundDeps = {}
): Promise<DeliverOutboundResult> {
  const claimed = await claimOutboundMessage(supabase, messageId);
  if (!claimed.ok) {
    return mapClaimFailure(claimed);
  }

  const to = (email.to || claimed.recipient_email || "").trim();
  if (!to) {
    await settleOutboundMessage(supabase, {
      messageId,
      status: "failed",
      provider: "resend",
      lastError: "No recipient email.",
    });
    return { ok: false, messageId, status: "failed", error: "No recipient email." };
  }

  const sendEmail = deps.sendEmail ?? sendNotificationEmail;
  const subject = email.subject || claimed.subject || "Reanvil notification";

  let sendResult: SendNotificationEmailResult;
  try {
    sendResult = await sendEmail({
      ...email,
      to,
      subject,
      idempotencyKey: claimed.idempotency_key,
    });
  } catch {
    await settleOutboundMessage(supabase, {
      messageId,
      status: "unknown",
      provider: "resend",
      lastError: OUTBOUND_UNKNOWN_REVIEW_COPY,
    });
    return {
      ok: false,
      messageId,
      status: "unknown",
      unknownOutcome: true,
      error: OUTBOUND_UNKNOWN_REVIEW_COPY,
    };
  }

  if (!sendResult.ok) {
    // Known local block / missing config / provider refusal → failed (retryable).
    const settled = await settleOutboundMessage(supabase, {
      messageId,
      status: "failed",
      provider: "resend",
      lastError: sanitizeOutboundError(sendResult.error) || sendResult.error,
    });
    if (!settled.ok) {
      return {
        ok: false,
        messageId,
        status: "unknown",
        unknownOutcome: true,
        error: OUTBOUND_UNKNOWN_REVIEW_COPY,
      };
    }
    return {
      ok: false,
      messageId,
      status: "failed",
      error: sendResult.error,
    };
  }

  const providerMessageId = sendResult.messageId?.trim() || "";
  if (!providerMessageId) {
    await settleOutboundMessage(supabase, {
      messageId,
      status: "unknown",
      provider: "resend",
      lastError: "Provider did not return a message id.",
    });
    return {
      ok: false,
      messageId,
      status: "unknown",
      unknownOutcome: true,
      error: OUTBOUND_UNKNOWN_REVIEW_COPY,
    };
  }

  const settled = await settleOutboundMessage(supabase, {
    messageId,
    status: "provider_accepted",
    provider: "resend",
    providerMessageId,
  });

  if (!settled.ok) {
    // Provider accepted but we could not persist — treat as unknown, do not resend.
    await settleOutboundMessage(supabase, {
      messageId,
      status: "unknown",
      provider: "resend",
      providerMessageId,
      lastError:
        "Provider accepted the email, but Reanvil could not store the outcome. Do not resend.",
    }).catch(() => undefined);
    return {
      ok: false,
      messageId,
      status: "unknown",
      unknownOutcome: true,
      providerAccepted: true,
      error:
        "Provider accepted the email, but Reanvil could not store the outcome. Do not resend.",
    };
  }

  return {
    ok: true,
    messageId,
    status: "provider_accepted",
    providerAccepted: true,
  };
}

/**
 * Labelled local/dev path: claim → settle as simulated. Never calls Resend.
 */
export async function simulateOutboundDelivery(
  supabase: SupabaseClient,
  messageId: string,
  simulatedProviderId?: string
): Promise<DeliverOutboundResult> {
  // Still refuse if somehow pointed away from local without intending simulate —
  // callers must only use this under isDevTestingEnabled in later stages.
  void outboundEmailBlockReason;

  const claimed = await claimOutboundMessage(supabase, messageId);
  if (!claimed.ok) {
    return mapClaimFailure(claimed);
  }

  const fakeId =
    simulatedProviderId?.trim() ||
    `simulated-${claimed.idempotency_key || messageId}`.slice(0, 200);

  const settled = await settleOutboundMessage(supabase, {
    messageId,
    status: "simulated",
    provider: "simulated",
    providerMessageId: fakeId,
  });

  if (!settled.ok) {
    return {
      ok: false,
      messageId,
      status: "unknown",
      unknownOutcome: true,
      error: settled.reason || OUTBOUND_UNKNOWN_REVIEW_COPY,
    };
  }

  return {
    ok: true,
    messageId,
    status: "simulated",
    simulated: true,
  };
}

function mapClaimFailure(claimed: OutboundRpcResult): DeliverOutboundResult {
  if (claimed.status === "provider_accepted" || claimed.status === "simulated") {
    return {
      ok: true,
      messageId: claimed.id,
      status: claimed.status,
      providerAccepted: claimed.status === "provider_accepted",
      simulated: claimed.status === "simulated",
    };
  }
  if (claimed.status === "unknown" || claimed.status === "sending") {
    return {
      ok: false,
      messageId: claimed.id,
      status: claimed.status,
      unknownOutcome: true,
      error: claimed.reason || OUTBOUND_UNKNOWN_REVIEW_COPY,
    };
  }
  return {
    ok: false,
    messageId: claimed.id,
    status: claimed.status,
    error: claimed.reason || "Could not claim notification.",
  };
}
