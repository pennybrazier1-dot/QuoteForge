/** Stage 9G.1 outbound notification foundation types. */

export const OUTBOUND_EVENT_KINDS = [
  "enquiry_received",
  "quote_accepted",
  "quote_declined",
  "customer_message",
  "trader_reply",
  "payment_requested",
  "payment_received",
  "invoice_issued",
  "invoice_cancelled",
  "credit_note_issued",
  "visit_rescheduled",
  "visit_cancelled",
] as const;

export type OutboundEventKind = (typeof OUTBOUND_EVENT_KINDS)[number];

export const OUTBOUND_SOURCE_TYPES = [
  "enquiry",
  "proposal",
  "proposal_customer_message",
  "visit",
  "invoice",
  "proposal_payment",
  "credit_note",
] as const;

export type OutboundSourceType = (typeof OUTBOUND_SOURCE_TYPES)[number];

export const OUTBOUND_STATUSES = [
  "needed",
  "sending",
  "provider_accepted",
  "failed",
  "unknown",
  "simulated",
] as const;

export type OutboundStatus = (typeof OUTBOUND_STATUSES)[number];

export type OutboundAudience = "trader" | "customer";
export type OutboundProvider = "resend" | "simulated";

export type OutboundMessageRow = {
  id: string;
  workspace_id: string;
  event_kind: OutboundEventKind;
  audience: OutboundAudience;
  source_type: OutboundSourceType;
  source_id: string;
  proposal_id: string | null;
  enquiry_id: string | null;
  visit_id: string | null;
  invoice_id: string | null;
  recipient_email: string;
  subject: string | null;
  status: OutboundStatus;
  provider: OutboundProvider | null;
  provider_message_id: string | null;
  attempt_at: string | null;
  attempt_count: number;
  last_error: string | null;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Safe fields for trader UI — never expose raw secrets. */
export type OutboundTraderView = {
  id: string;
  eventKind: OutboundEventKind;
  audience: OutboundAudience;
  status: OutboundStatus;
  statusLabel: string;
  statusDetail: string;
  canRetry: boolean;
  canConfirmWithoutResend: boolean;
  needsProviderMessageId: boolean;
  /** Masked recipient for display (e.g. c***@example.com). */
  recipientDisplay: string;
  subject: string | null;
  attemptAt: string | null;
  attemptCount: number;
  hasProviderMessageId: boolean;
  lastErrorSafe: string | null;
  proposalId: string | null;
  enquiryId: string | null;
  visitId: string | null;
  invoiceId: string | null;
};

export type EnqueueOutboundInput = {
  workspaceId: string;
  eventKind: OutboundEventKind;
  audience: OutboundAudience;
  sourceType: OutboundSourceType;
  sourceId: string;
  recipientEmail: string;
  idempotencyKey: string;
  subject?: string | null;
  proposalId?: string | null;
  enquiryId?: string | null;
  visitId?: string | null;
  invoiceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type OutboundRpcResult = {
  ok: boolean;
  created?: boolean;
  id?: string;
  status?: OutboundStatus;
  reason?: string;
  provider_message_id?: string | null;
  attempt_at?: string | null;
  attempt_count?: number;
  idempotency_key?: string;
  recipient_email?: string;
  subject?: string | null;
  event_kind?: OutboundEventKind;
  audience?: OutboundAudience;
  workspace_id?: string;
  reconciled?: number;
};

export const OUTBOUND_UNKNOWN_REVIEW_COPY =
  "The email provider outcome is unsettled. Do not resend. Confirm the provider message id from the email dashboard, or confirm sent without resending if you already have the id.";

export const OUTBOUND_PROVIDER_ACCEPTED_NOTE =
  "Provider acceptance means Resend accepted the send request. It is not proof the customer received or opened the email.";
