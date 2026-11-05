"use server";

/**
 * Payment-only outbound recovery actions (Stage 9L.4 Part 2Z).
 * Intentionally excludes enquiry/quote/conversation/visit/invoice/CN paths.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  confirmOutboundMessageWithoutResend,
  reconcileStaleOutboundSending,
} from "@/lib/outbound/rpc";
import {
  buildPaymentRetryPayload,
  deliverPaymentNotification,
} from "@/lib/payments/server/notify-payment";
import { deliverOutboundMessage } from "@/lib/outbound/deliver";
import {
  findOutboundByIdempotencyKey,
  loadOutboundMessage,
} from "@/lib/outbound/handoff";
import {
  parsePaymentReceivedLedgerIdFromKey,
  paymentReceivedLedgerKey,
  paymentRequestedKey,
} from "@/lib/outbound/keys";
import { OUTBOUND_UNKNOWN_REVIEW_COPY } from "@/lib/outbound/types";
import { sanitizeOutboundError } from "@/lib/outbound/redact";
import type { OutboundEmailPayload } from "@/lib/outbound/deliver";
import type { OutboundMessageRow } from "@/lib/outbound/types";

export type OutboundRecoveryActionState = {
  ok?: boolean;
  error?: string;
  unknownOutcome?: boolean;
  providerAccepted?: boolean;
  messageId?: string;
  status?: string;
  recovered?: number;
  attempted?: number;
};

const PAYMENT_EVENT_KINDS = new Set(["payment_requested", "payment_received"]);

async function requireTraderClient(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      workspaceId: string;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (!(await userHasProfile(user.id))) {
    return { ok: false, error: "Please complete onboarding first." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  const workspaceId = String(profile?.workspace_id || "").trim();
  if (!workspaceId) {
    return { ok: false, error: "Workspace not found." };
  }
  return { ok: true, supabase, userId: user.id, workspaceId };
}

function revalidatePaymentPaths(proposalId: string | null) {
  revalidatePath("/dashboard");
  if (proposalId) {
    revalidatePath(`/proposals/${proposalId}`);
  }
}

function assertPaymentRow(
  row: OutboundMessageRow,
  workspaceId: string
): string | null {
  if (row.workspace_id !== workspaceId) {
    return "Notification not found.";
  }
  if (!PAYMENT_EVENT_KINDS.has(row.event_kind)) {
    return "Only payment notifications can be recovered here.";
  }
  return null;
}

async function buildPaymentReceivedRetryOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  row: OutboundMessageRow
): Promise<
  | {
      ok: true;
      options: {
        ledgerPaymentId: string;
        amountRecordedPence: number;
        outstandingPence: number;
        fullySettled: boolean;
      };
    }
  | { ok: false; error: string }
> {
  const ledgerPaymentId = parsePaymentReceivedLedgerIdFromKey(
    row.idempotency_key
  );
  if (!ledgerPaymentId) {
    return {
      ok: false,
      error:
        "This payment email uses a legacy identity and cannot be safely rebuilt. Confirm provider status without resending if needed.",
    };
  }

  const { data: payment, error } = await supabase
    .from("invoice_payments")
    .select("id, amount_pence, workspace_id, proposal_id, is_legacy_marker")
    .eq("id", ledgerPaymentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !payment || payment.is_legacy_marker) {
    return {
      ok: false,
      error: "Original payment record was not found in this workspace.",
    };
  }

  if (
    row.proposal_id &&
    String(payment.proposal_id) !== String(row.proposal_id)
  ) {
    return {
      ok: false,
      error: "Payment record does not match this notification.",
    };
  }

  const amountRecordedPence = Math.max(
    0,
    Math.round(Number(payment.amount_pence ?? 0))
  );
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const metaFullySettled = meta.fully_settled;
  const metaStatus =
    typeof meta.payment_status === "string" ? meta.payment_status : null;

  let fullySettled: boolean;
  if (metaFullySettled === true) {
    fullySettled = true;
  } else if (metaFullySettled === false) {
    fullySettled = false;
  } else if (metaStatus === "paid") {
    fullySettled = true;
  } else if (metaStatus === "partially_paid") {
    fullySettled = false;
  } else {
    return {
      ok: false,
      error:
        "Cannot safely rebuild this payment email — settlement context was not stored with the notification.",
    };
  }

  // Partial emails need the outstanding balance from send-time. We never recompute
  // from current invoice state (that can drift). Without a stored outstanding,
  // refuse rather than invent £0.00 remaining.
  let outstandingPence = 0;
  if (!fullySettled) {
    const storedOutstanding = meta.outstanding_pence;
    if (
      typeof storedOutstanding === "number" &&
      Number.isFinite(storedOutstanding)
    ) {
      outstandingPence = Math.max(0, Math.round(storedOutstanding));
    } else {
      return {
        ok: false,
        error:
          "Cannot safely rebuild this partial-payment email — original outstanding balance was not stored. Confirm provider status without resending if needed.",
      };
    }
  }

  return {
    ok: true,
    options: {
      ledgerPaymentId,
      amountRecordedPence,
      outstandingPence,
      fullySettled,
    },
  };
}

/**
 * Retry a needed/failed payment outbound row (same id — never a second key).
 */
export async function retryOutboundMessageAction(
  _prev: OutboundRecoveryActionState,
  formData: FormData
): Promise<OutboundRecoveryActionState> {
  const auth = await requireTraderClient();
  if (!auth.ok) return { error: auth.error };

  const messageId = String(formData.get("outboundMessageId") ?? "").trim();
  if (!messageId) return { error: "Notification not found." };

  await reconcileStaleOutboundSending(auth.supabase);

  const row = await loadOutboundMessage(auth.supabase, messageId);
  if (!row) return { error: "Notification not found." };

  const ownershipError = assertPaymentRow(row, auth.workspaceId);
  if (ownershipError) return { error: ownershipError };

  if (row.status === "unknown") {
    return {
      error: OUTBOUND_UNKNOWN_REVIEW_COPY,
      unknownOutcome: true,
      status: "unknown",
      messageId: row.provider_message_id || undefined,
    };
  }
  if (row.status === "sending") {
    return {
      error:
        "A send attempt is still in progress. Wait, then refresh. Do not retry yet.",
      status: "sending",
    };
  }
  if (row.status !== "needed" && row.status !== "failed") {
    return {
      error: "This notification cannot be retried in its current state.",
      status: row.status,
    };
  }

  if (!row.proposal_id) {
    return { error: "Payment notification is missing its proposal link." };
  }

  let receivedOptions:
    | {
        ledgerPaymentId: string;
        amountRecordedPence: number;
        outstandingPence: number;
        fullySettled: boolean;
      }
    | undefined;

  if (row.event_kind === "payment_requested") {
    // Only the current durable request identity may rebuild from proposal fields.
    // Superseded (replaced) request rows must not silently pick up a newer amount.
    const { data: proposal } = await auth.supabase
      .from("proposals")
      .select("payment_request_event_id")
      .eq("id", row.proposal_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    const currentEventId = String(
      proposal?.payment_request_event_id || ""
    ).trim();
    const expectedKey = currentEventId
      ? paymentRequestedKey(row.proposal_id, currentEventId)
      : "";
    if (!currentEventId || row.idempotency_key !== expectedKey) {
      return {
        error:
          "This payment-request email is not the current request identity and cannot be safely rebuilt. Confirm provider status without resending if needed.",
      };
    }
  }

  if (row.event_kind === "payment_received") {
    const built = await buildPaymentReceivedRetryOptions(
      auth.supabase,
      auth.workspaceId,
      row
    );
    if (!built.ok) return { error: built.error };
    receivedOptions = built.options;
  }

  const specific = await buildPaymentRetryPayload(
    auth.supabase,
    row.proposal_id,
    auth.workspaceId,
    row.event_kind === "payment_received"
      ? "payment_received"
      : "payment_requested",
    receivedOptions
  );
  if (!specific.ok) {
    return { error: specific.error };
  }

  const emailPayload: OutboundEmailPayload = {
    to: specific.to,
    subject: specific.subject,
    message: specific.message,
    html: specific.html,
    businessName: specific.businessName,
    heading: specific.heading,
    preheader: specific.preheader,
    ctaUrl: specific.ctaUrl,
    ctaLabel: specific.ctaLabel,
    audience: "customer",
  };

  const result = await deliverOutboundMessage(
    auth.supabase,
    messageId,
    emailPayload
  );

  revalidatePaymentPaths(row.proposal_id);

  if (result.unknownOutcome) {
    return {
      ok: false,
      unknownOutcome: true,
      error: result.error || OUTBOUND_UNKNOWN_REVIEW_COPY,
      status: result.status,
      messageId: result.messageId,
    };
  }
  if (!result.ok) {
    return {
      ok: false,
      error:
        sanitizeOutboundError(result.error) ||
        result.error ||
        "Retry failed.",
      status: result.status,
    };
  }
  return {
    ok: true,
    providerAccepted: result.providerAccepted,
    status: result.status,
    messageId: result.messageId,
  };
}

export async function confirmOutboundWithoutResendAction(
  _prev: OutboundRecoveryActionState,
  formData: FormData
): Promise<OutboundRecoveryActionState> {
  const auth = await requireTraderClient();
  if (!auth.ok) return { error: auth.error };

  const messageId = String(formData.get("outboundMessageId") ?? "").trim();
  if (!messageId) return { error: "Notification not found." };

  const row = await loadOutboundMessage(auth.supabase, messageId);
  if (!row) return { error: "Notification not found." };

  const ownershipError = assertPaymentRow(row, auth.workspaceId);
  if (ownershipError) return { error: ownershipError };

  if (row.status !== "unknown") {
    return {
      error: "Only unsettled notifications can be confirmed without resending.",
      status: row.status,
    };
  }

  const result = await confirmOutboundMessageWithoutResend(
    auth.supabase,
    messageId,
    row.provider_message_id
  );

  revalidatePaymentPaths(row.proposal_id);

  if (!result.ok) {
    return {
      error: result.reason || OUTBOUND_UNKNOWN_REVIEW_COPY,
      unknownOutcome: true,
      status: result.status,
    };
  }
  return {
    ok: true,
    providerAccepted: true,
    status: "provider_accepted",
    messageId: result.provider_message_id || undefined,
  };
}

export async function recordOutboundProviderIdAction(
  _prev: OutboundRecoveryActionState,
  formData: FormData
): Promise<OutboundRecoveryActionState> {
  const auth = await requireTraderClient();
  if (!auth.ok) return { error: auth.error };

  const messageId = String(formData.get("outboundMessageId") ?? "").trim();
  const providerMessageId = String(formData.get("messageId") ?? "").trim();
  if (!messageId) return { error: "Notification not found." };
  if (!providerMessageId || providerMessageId.length < 8) {
    return {
      error: "Enter the provider message id from the email dashboard.",
      unknownOutcome: true,
    };
  }

  const row = await loadOutboundMessage(auth.supabase, messageId);
  if (!row) return { error: "Notification not found." };

  const ownershipError = assertPaymentRow(row, auth.workspaceId);
  if (ownershipError) return { error: ownershipError };

  if (row.status !== "unknown") {
    return {
      error: "Only unsettled notifications can record a provider id.",
      status: row.status,
    };
  }

  const result = await confirmOutboundMessageWithoutResend(
    auth.supabase,
    messageId,
    providerMessageId
  );

  revalidatePaymentPaths(row.proposal_id);

  if (!result.ok) {
    return {
      error: result.reason || "Could not record the provider id.",
      unknownOutcome: true,
      status: result.status,
    };
  }
  return {
    ok: true,
    providerAccepted: true,
    status: "provider_accepted",
    messageId: providerMessageId,
  };
}

/**
 * Explicit trader action: enqueue missing payment outbound for this proposal only.
 * Distinct from retrying an existing row. Never invents payment_request_event_id.
 */
export async function reconcileMissingPaymentOutboundForProposalAction(
  _prev: OutboundRecoveryActionState,
  formData: FormData
): Promise<OutboundRecoveryActionState> {
  const auth = await requireTraderClient();
  if (!auth.ok) return { error: auth.error };

  const proposalId = String(formData.get("proposalId") ?? "").trim();
  if (!proposalId) return { error: "Job not found." };

  const { data: proposal, error: loadError } = await auth.supabase
    .from("proposals")
    .select(
      "id, workspace_id, customer_name, customer_email, title, payment_status, payment_due_amount, payment_methods_issued, payment_requested_at, payment_request_event_id, paid_at, closed_at"
    )
    .eq("id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Job not found." };
  }

  let attempted = 0;
  let recovered = 0;

  const eventId = String(proposal.payment_request_event_id || "").trim();
  if (
    eventId &&
    (proposal.payment_status === "requested" ||
      proposal.payment_status === "partially_paid") &&
    !proposal.closed_at
  ) {
    const key = paymentRequestedKey(proposal.id, eventId);
    const existing = await findOutboundByIdempotencyKey(
      auth.supabase,
      auth.workspaceId,
      key
    );
    if (!existing) {
      attempted += 1;
      const result = await deliverPaymentNotification(
        auth.supabase,
        proposal,
        "payment_requested",
        { requestEventId: eventId }
      );
      if (result.ok && !result.skipped) {
        recovered += 1;
      }
    }
  }

  const { data: payments } = await auth.supabase
    .from("invoice_payments")
    .select("id, amount_pence, recorded_at")
    .eq("workspace_id", auth.workspaceId)
    .eq("proposal_id", proposalId)
    .eq("is_legacy_marker", false)
    .order("recorded_at", { ascending: false })
    .limit(40);

  const { data: invoice } = await auth.supabase
    .from("invoices")
    .select("balance_due")
    .eq("proposal_id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "approved")
    .maybeSingle();
  const balanceDue = Math.max(0, Math.round(Number(invoice?.balance_due ?? 0)));

  for (const payment of payments ?? []) {
    if (proposal.closed_at) break;
    const paymentId = String(payment.id);
    const key = paymentReceivedLedgerKey(paymentId);
    const existing = await findOutboundByIdempotencyKey(
      auth.supabase,
      auth.workspaceId,
      key
    );
    if (existing) continue;

    attempted += 1;
    const result = await deliverPaymentNotification(
      auth.supabase,
      proposal,
      "payment_received",
      {
        ledgerPaymentId: paymentId,
        amountRecordedPence: Math.round(Number(payment.amount_pence ?? 0)),
        outstandingPence: balanceDue,
        fullySettled: balanceDue === 0,
      }
    );
    if (result.ok && !result.skipped) {
      recovered += 1;
    }
  }

  revalidatePaymentPaths(proposalId);

  if (attempted === 0) {
    return {
      ok: true,
      recovered: 0,
      attempted: 0,
      error: undefined,
    };
  }

  return {
    ok: true,
    recovered,
    attempted,
  };
}
