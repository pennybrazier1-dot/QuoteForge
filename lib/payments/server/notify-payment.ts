import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkspaceEmailLogoUrl } from "@/lib/proposals/pdf/customer-branding";
import { ensureProposalCustomerAccessToken } from "@/lib/proposals/customer-portal/ensure-token";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import {
  buildPaymentPartialReceivedEmail,
  buildPaymentReceivedEmail,
  buildPaymentRequestedEmail,
} from "@/lib/payments/email";
import { isPaymentMethod, type PaymentMethod } from "@/lib/payments/types";
import {
  enqueueAndDeliverOutboundMessage,
  type DeliverOutboundResult,
} from "@/lib/outbound/deliver";
import { findOutboundByIdempotencyKey } from "@/lib/outbound/handoff";
import {
  paymentReceivedKey,
  paymentReceivedLedgerKey,
  paymentRequestedKey,
} from "@/lib/outbound/keys";

export type PaymentNotifyKind = "payment_requested" | "payment_received";

export type PaymentNotifySource = {
  id: string;
  workspace_id: string;
  customer_name: string | null;
  customer_email: string | null;
  title: string | null;
  payment_status: string | null;
  payment_due_amount: number | null;
  payment_methods_issued: unknown;
  payment_requested_at: string | null;
  /** Durable current payment-request notification identity (not a timestamp). */
  payment_request_event_id: string | null;
  paid_at: string | null;
  closed_at: string | null;
};

export type PaymentReceivedNotifyOptions = {
  /** invoice_payments.id — preferred stable identity for each recorded payment. */
  ledgerPaymentId?: string | null;
  /** Amount recorded in this ledger event (pence). */
  amountRecordedPence?: number | null;
  /** Outstanding balance after this payment (pence). */
  outstandingPence?: number | null;
  /** When true, send paid-in-full confirmation. */
  fullySettled?: boolean;
};

export type PaymentRequestedNotifyOptions = {
  /**
   * Durable payment-request event id. Must match proposals.payment_request_event_id
   * for the authorised request. Never fall back to payment_requested_at.
   */
  requestEventId?: string | null;
};

export type NotifyPaymentResult =
  | {
      ok: true;
      skipped?: undefined;
      outboundId: string;
      delivery: DeliverOutboundResult;
    }
  | {
      ok: true;
      skipped: "no_recipient" | "already_terminal" | "not_notifiable";
      reason: string;
    }
  | { ok: false; error: string };

const PROPOSAL_PAYMENT_SELECT =
  "id, workspace_id, customer_name, customer_email, title, payment_status, payment_due_amount, payment_methods_issued, payment_requested_at, payment_request_event_id, paid_at, closed_at";

function issuedMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry)).filter(isPaymentMethod);
}

function amountLabel(pence: number | null | undefined): string {
  return formatPenceAsGbp(Math.max(0, Number(pence ?? 0)));
}

/**
 * Best-effort customer notify after a payment request is saved.
 * Never throws into the trader action — financial save already succeeded.
 */
export async function notifyCustomerOfPaymentRequested(
  supabase: SupabaseClient,
  proposalId: string,
  options?: PaymentRequestedNotifyOptions
): Promise<NotifyPaymentResult> {
  return notifyCustomerOfPayment(
    supabase,
    proposalId,
    "payment_requested",
    options
  );
}

/**
 * Best-effort customer notify after a ledger payment is recorded.
 * Never throws into the trader action — payment save already succeeded.
 */
export async function notifyCustomerOfPaymentReceived(
  supabase: SupabaseClient,
  proposalId: string,
  options?: PaymentReceivedNotifyOptions
): Promise<NotifyPaymentResult> {
  return notifyCustomerOfPayment(
    supabase,
    proposalId,
    "payment_received",
    options
  );
}

export async function notifyCustomerOfPayment(
  supabase: SupabaseClient,
  proposalId: string,
  kind: PaymentNotifyKind,
  options?: PaymentRequestedNotifyOptions & PaymentReceivedNotifyOptions
): Promise<NotifyPaymentResult> {
  try {
    const { data: proposal, error } = await supabase
      .from("proposals")
      .select(PROPOSAL_PAYMENT_SELECT)
      .eq("id", proposalId)
      .maybeSingle();

    if (error || !proposal) {
      return { ok: false, error: "Proposal not found for payment notification." };
    }

    return deliverPaymentNotification(
      supabase,
      proposal as PaymentNotifySource,
      kind,
      options
    );
  } catch (error) {
    console.warn(
      "[payment-notify]",
      error instanceof Error ? error.message : "notify failed"
    );
    return { ok: false, error: "Could not send payment notification." };
  }
}

/** Safe wrappers for trader actions — never throw. */
export async function safeNotifyPaymentRequested(
  supabase: SupabaseClient,
  proposalId: string,
  options?: PaymentRequestedNotifyOptions
): Promise<NotifyPaymentResult> {
  try {
    return await notifyCustomerOfPaymentRequested(
      supabase,
      proposalId,
      options
    );
  } catch (error) {
    console.warn(
      "[payment-notify]",
      error instanceof Error ? error.message : "safe notify failed"
    );
    return { ok: false, error: "Could not send payment request email." };
  }
}

export async function safeNotifyPaymentReceived(
  supabase: SupabaseClient,
  proposalId: string,
  options?: PaymentReceivedNotifyOptions
): Promise<NotifyPaymentResult> {
  try {
    return await notifyCustomerOfPaymentReceived(
      supabase,
      proposalId,
      options
    );
  } catch (error) {
    console.warn(
      "[payment-notify]",
      error instanceof Error ? error.message : "safe notify failed"
    );
    return { ok: false, error: "Could not send payment received email." };
  }
}

export async function deliverPaymentNotification(
  supabase: SupabaseClient,
  proposal: PaymentNotifySource,
  kind: PaymentNotifyKind,
  options?: PaymentRequestedNotifyOptions & PaymentReceivedNotifyOptions
): Promise<NotifyPaymentResult> {
  if (proposal.closed_at) {
    return {
      ok: true,
      skipped: "not_notifiable",
      reason: "Closed jobs do not send payment notifications.",
    };
  }

  let idempotencyKey: string;
  let eventVersion: string;

  if (kind === "payment_requested") {
    // Active request may sit on requested (first ask) or partially_paid (later instalment).
    if (
      proposal.payment_status !== "requested" &&
      proposal.payment_status !== "partially_paid"
    ) {
      return {
        ok: true,
        skipped: "not_notifiable",
        reason: "Payment has not been requested.",
      };
    }
    if (
      proposal.payment_due_amount == null ||
      Number(proposal.payment_due_amount) <= 0
    ) {
      return {
        ok: true,
        skipped: "not_notifiable",
        reason: "Payment request has no amount.",
      };
    }
    // Prefer explicit option (caller just persisted), else durable proposal column.
    // Never use payment_requested_at — it is display/audit only and changes on retry.
    const requestEventId =
      options?.requestEventId?.trim() ||
      proposal.payment_request_event_id?.trim() ||
      "";
    if (!requestEventId) {
      return {
        ok: true,
        skipped: "not_notifiable",
        reason: "Payment request has no durable event id.",
      };
    }
    eventVersion = requestEventId;
    idempotencyKey = paymentRequestedKey(proposal.id, requestEventId);
  } else {
    const ledgerPaymentId = options?.ledgerPaymentId?.trim() || "";
    // Prefer the caller's settlement flag (ledger event). Do not infer "fully
    // paid" solely from the proposal when notifying an older partial after the
    // invoice has since been settled.
    const fullySettled =
      options?.fullySettled !== undefined
        ? Boolean(options.fullySettled)
        : proposal.payment_status === "paid";

    if (ledgerPaymentId) {
      eventVersion = ledgerPaymentId;
      idempotencyKey = paymentReceivedLedgerKey(ledgerPaymentId);
    } else if (fullySettled && proposal.paid_at?.trim()) {
      // Legacy / no-invoice settlement path.
      eventVersion = proposal.paid_at.trim();
      idempotencyKey = paymentReceivedKey(proposal.id, eventVersion);
    } else {
      return {
        ok: true,
        skipped: "not_notifiable",
        reason: "Payment received has no stable ledger or paid-at identity.",
      };
    }

    if (
      !fullySettled &&
      proposal.payment_status !== "partially_paid" &&
      proposal.payment_status !== "requested" &&
      proposal.payment_status !== "paid"
    ) {
      return {
        ok: true,
        skipped: "not_notifiable",
        reason: "Payment has not been marked received.",
      };
    }
  }

  const recipient = proposal.customer_email?.trim() ?? "";
  if (!recipient || !recipient.includes("@")) {
    return {
      ok: true,
      skipped: "no_recipient",
      reason: "Customer has no email address for payment notifications.",
    };
  }

  const workspaceId = proposal.workspace_id;

  const existing = await findOutboundByIdempotencyKey(
    supabase,
    workspaceId,
    idempotencyKey
  );
  if (
    existing &&
    (existing.status === "provider_accepted" || existing.status === "simulated")
  ) {
    return {
      ok: true,
      skipped: "already_terminal",
      reason: "Payment notification already accepted by the provider.",
    };
  }

  const tokenResult = await ensureProposalCustomerAccessToken(
    supabase,
    proposal.id
  );
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: tokenResult.error || "Could not prepare customer portal link.",
    };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("business_name, trade_type")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError) {
    return {
      ok: false,
      error: `Could not load workspace for notification: ${workspaceError.message}`,
    };
  }

  const businessName = workspace?.business_name?.trim() || "Reanvil";
  const jobTitle = proposal.title?.trim() || "your job";
  const methods = issuedMethods(proposal.payment_methods_issued);
  const dueLabel = amountLabel(proposal.payment_due_amount);
  const logoUrl = loadWorkspaceEmailLogoUrl({});

  const recordedLabel = amountLabel(
    options?.amountRecordedPence ?? proposal.payment_due_amount
  );
  const outstandingLabel = amountLabel(options?.outstandingPence ?? 0);
  const emailFullySettled =
    kind === "payment_received"
      ? options?.fullySettled !== undefined
        ? Boolean(options.fullySettled)
        : proposal.payment_status === "paid"
      : false;

  const email =
    kind === "payment_requested"
      ? buildPaymentRequestedEmail({
          businessName,
          customerName: proposal.customer_name,
          jobTitle,
          amountLabel: dueLabel,
          methods,
          portalToken: tokenResult.token,
          logoUrl,
          tradeLabel: workspace?.trade_type,
        })
      : emailFullySettled
        ? buildPaymentReceivedEmail({
            businessName,
            customerName: proposal.customer_name,
            jobTitle,
            amountLabel: recordedLabel,
            portalToken: tokenResult.token,
            logoUrl,
            tradeLabel: workspace?.trade_type,
            fullyPaid: true,
          })
        : buildPaymentPartialReceivedEmail({
            businessName,
            customerName: proposal.customer_name,
            jobTitle,
            amountLabel: recordedLabel,
            outstandingLabel,
            portalToken: tokenResult.token,
            logoUrl,
            tradeLabel: workspace?.trade_type,
          });

  const delivery = await enqueueAndDeliverOutboundMessage(
    supabase,
    {
      workspaceId,
      eventKind: kind,
      audience: "customer",
      sourceType: "proposal_payment",
      sourceId: proposal.id,
      recipientEmail: recipient,
      idempotencyKey,
      subject: email.subject,
      proposalId: proposal.id,
      metadata: {
        // Display-only — never bank account numbers, portal tokens, or internal keys.
        payment_status: proposal.payment_status,
        amount_label:
          kind === "payment_requested" ? dueLabel : recordedLabel,
        methods,
        event_at: eventVersion,
        fully_settled:
          kind === "payment_received" ? emailFullySettled : undefined,
      },
    },
    {
      to: recipient,
      subject: email.subject,
      message: email.text,
      html: email.html,
      businessName: email.businessName,
      heading: email.heading,
      preheader: email.preheader,
      ctaUrl: email.ctaUrl,
      ctaLabel: email.ctaLabel,
      audience: "customer",
    }
  );

  if (!delivery.messageId && !delivery.ok) {
    return {
      ok: false,
      error: delivery.error || "Payment notification could not be sent.",
    };
  }

  return {
    ok: true,
    outboundId: delivery.messageId || existing?.id || "",
    delivery,
  };
}

/**
 * Workspace-scoped recovery for payment emails missing outbound rows.
 * Never changes payment amounts, bank details, or payment_status.
 */
export async function recoverMissingPaymentNotifications(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ recovered: number; attempted: number }> {
  let recovered = 0;
  let attempted = 0;

  // Reconcile missing outbound for the CURRENT durable request identity only.
  // Includes partially_paid instalment requests. Does not invent event ids.
  const { data: requestedRows } = await supabase
    .from("proposals")
    .select(PROPOSAL_PAYMENT_SELECT)
    .eq("workspace_id", workspaceId)
    .in("payment_status", ["requested", "partially_paid"])
    .is("closed_at", null)
    .not("payment_request_event_id", "is", null)
    .order("payment_requested_at", { ascending: false })
    .limit(40);

  for (const row of (requestedRows ?? []) as PaymentNotifySource[]) {
    const eventId = String(row.payment_request_event_id || "").trim();
    if (!eventId) continue;
    const key = paymentRequestedKey(row.id, eventId);
    const existing = await findOutboundByIdempotencyKey(
      supabase,
      workspaceId,
      key
    );
    if (existing) continue;

    attempted += 1;
    const result = await deliverPaymentNotification(
      supabase,
      row,
      "payment_requested",
      { requestEventId: eventId }
    );
    if (result.ok && !result.skipped) {
      recovered += 1;
    }
  }

  // Ledger-based received recovery: find paid invoices with ledger rows missing outbound.
  const { data: recentPayments } = await supabase
    .from("invoice_payments")
    .select("id, proposal_id, amount_pence, recorded_at")
    .eq("workspace_id", workspaceId)
    .eq("is_legacy_marker", false)
    .order("recorded_at", { ascending: false })
    .limit(40);

  for (const payment of recentPayments ?? []) {
    const paymentId = String(payment.id);
    const key = paymentReceivedLedgerKey(paymentId);
    const existing = await findOutboundByIdempotencyKey(
      supabase,
      workspaceId,
      key
    );
    if (existing) continue;

    const { data: proposal } = await supabase
      .from("proposals")
      .select(PROPOSAL_PAYMENT_SELECT)
      .eq("id", payment.proposal_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!proposal || (proposal as PaymentNotifySource).closed_at) continue;

    const { data: invoice } = await supabase
      .from("invoices")
      .select("balance_due")
      .eq("proposal_id", payment.proposal_id)
      .eq("workspace_id", workspaceId)
      .eq("status", "approved")
      .maybeSingle();

    attempted += 1;
    const balanceDue = Math.max(0, Math.round(Number(invoice?.balance_due ?? 0)));
    const result = await deliverPaymentNotification(
      supabase,
      proposal as PaymentNotifySource,
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

  return { recovered, attempted };
}

/** Rebuild event-specific customer email payload for retry. */
export async function buildPaymentRetryPayload(
  supabase: SupabaseClient,
  proposalId: string,
  workspaceId: string,
  kind: PaymentNotifyKind,
  options?: PaymentReceivedNotifyOptions
): Promise<
  | {
      ok: true;
      to: string;
      subject: string;
      message: string;
      html: string;
      businessName: string;
      heading?: string;
      preheader?: string;
      ctaUrl?: string;
      ctaLabel?: string;
      audience: "customer";
    }
  | { ok: false; error: string }
> {
  const { data: proposal } = await supabase
    .from("proposals")
    .select(PROPOSAL_PAYMENT_SELECT)
    .eq("id", proposalId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!proposal) {
    return { ok: false, error: "Proposal not found." };
  }

  const source = proposal as PaymentNotifySource;
  if (
    kind === "payment_requested" &&
    source.payment_status !== "requested" &&
    source.payment_status !== "partially_paid"
  ) {
    return { ok: false, error: "Payment is no longer in a requested state." };
  }
  if (
    kind === "payment_received" &&
    source.payment_status !== "paid" &&
    source.payment_status !== "partially_paid" &&
    !options?.ledgerPaymentId
  ) {
    return { ok: false, error: "Payment is no longer marked as received." };
  }

  const to = source.customer_email?.trim() ?? "";
  if (!to) {
    return { ok: false, error: "Customer has no email address." };
  }

  const tokenResult = await ensureProposalCustomerAccessToken(
    supabase,
    source.id
  );
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error || "Portal link unavailable." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("business_name, trade_type")
    .eq("id", workspaceId)
    .maybeSingle();

  const businessName = workspace?.business_name?.trim() || "Reanvil";
  const jobTitle = source.title?.trim() || "your job";
  const dueLabel = amountLabel(source.payment_due_amount);
  const logoUrl = loadWorkspaceEmailLogoUrl({});
  const recordedLabel = amountLabel(
    options?.amountRecordedPence ?? source.payment_due_amount
  );
  const outstandingLabel = amountLabel(options?.outstandingPence ?? 0);
  const fullySettled =
    options?.fullySettled === true || source.payment_status === "paid";

  const email =
    kind === "payment_requested"
      ? buildPaymentRequestedEmail({
          businessName,
          customerName: source.customer_name,
          jobTitle,
          amountLabel: dueLabel,
          methods: issuedMethods(source.payment_methods_issued),
          portalToken: tokenResult.token,
          logoUrl,
          tradeLabel: workspace?.trade_type,
        })
      : fullySettled
        ? buildPaymentReceivedEmail({
            businessName,
            customerName: source.customer_name,
            jobTitle,
            amountLabel: recordedLabel,
            portalToken: tokenResult.token,
            logoUrl,
            tradeLabel: workspace?.trade_type,
            fullyPaid: true,
          })
        : buildPaymentPartialReceivedEmail({
            businessName,
            customerName: source.customer_name,
            jobTitle,
            amountLabel: recordedLabel,
            outstandingLabel,
            portalToken: tokenResult.token,
            logoUrl,
            tradeLabel: workspace?.trade_type,
          });

  return {
    ok: true,
    to,
    subject: email.subject,
    message: email.text,
    html: email.html,
    businessName: email.businessName,
    heading: email.heading,
    preheader: email.preheader,
    ctaUrl: email.ctaUrl,
    ctaLabel: email.ctaLabel,
    audience: "customer",
  };
}
