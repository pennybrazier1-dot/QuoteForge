import type { OutboundEventKind } from "@/lib/outbound/types";

/**
 * Build a stable Resend-safe idempotency key (1–256 chars).
 * Format: `{event}/{sourceId}` with optional version suffix.
 */
export function buildOutboundIdempotencyKey(
  eventKind: OutboundEventKind,
  sourceId: string,
  version?: string | null
): string {
  const id = sourceId.trim();
  const ver = version?.trim();
  const key = ver ? `${eventKind}/${id}/${ver}` : `${eventKind}/${id}`;
  if (!id || key.length === 0) {
    throw new Error("Outbound idempotency key requires a source id.");
  }
  if (key.length > 256) {
    throw new Error("Outbound idempotency key exceeds 256 characters.");
  }
  return key;
}

export function enquiryReceivedKey(enquiryId: string): string {
  return buildOutboundIdempotencyKey("enquiry_received", enquiryId);
}

export function quoteAcceptedKey(proposalId: string): string {
  return buildOutboundIdempotencyKey("quote_accepted", proposalId);
}

export function quoteDeclinedKey(proposalId: string): string {
  return buildOutboundIdempotencyKey("quote_declined", proposalId);
}

export function customerMessageKey(messageId: string): string {
  return buildOutboundIdempotencyKey("customer_message", messageId);
}

export function traderReplyKey(messageId: string): string {
  return buildOutboundIdempotencyKey("trader_reply", messageId);
}

/**
 * One outbound row per payment-request event.
 * `eventId` is a stable client request id (preferred) or payment_requested_at.
 */
export function paymentRequestedKey(
  proposalId: string,
  eventId: string
): string {
  return buildOutboundIdempotencyKey("payment_requested", proposalId, eventId);
}

/**
 * One outbound row per recorded ledger payment (deposit, instalment, or final).
 * `ledgerPaymentId` is invoice_payments.id — stable across retries.
 */
export function paymentReceivedLedgerKey(ledgerPaymentId: string): string {
  return buildOutboundIdempotencyKey("payment_received", ledgerPaymentId);
}

/**
 * Legacy full-settlement key (pre-ledger). Prefer paymentReceivedLedgerKey.
 * `paidAt` must be the proposal's paid_at when no ledger payment id exists.
 */
export function paymentReceivedKey(proposalId: string, paidAt: string): string {
  return buildOutboundIdempotencyKey("payment_received", proposalId, paidAt);
}

export function invoiceIssuedKey(invoiceId: string): string {
  return buildOutboundIdempotencyKey("invoice_issued", invoiceId);
}

/** One cancel notice per cancelled (void) invoice id. */
export function invoiceCancelledKey(cancelledInvoiceId: string): string {
  return buildOutboundIdempotencyKey("invoice_cancelled", cancelledInvoiceId);
}

/** One explicit credit-note email per approved credit note id. */
export function creditNoteIssuedKey(creditNoteId: string): string {
  return buildOutboundIdempotencyKey("credit_note_issued", creditNoteId);
}

export function visitRescheduledKey(
  visitId: string,
  startsAt: string
): string {
  return buildOutboundIdempotencyKey("visit_rescheduled", visitId, startsAt);
}

export function visitCancelledKey(
  visitId: string,
  cancelledAt: string
): string {
  return buildOutboundIdempotencyKey("visit_cancelled", visitId, cancelledAt);
}
