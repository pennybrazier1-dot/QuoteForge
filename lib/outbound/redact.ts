import type { OutboundMessageRow, OutboundTraderView } from "@/lib/outbound/types";
import {
  canConfirmOutboundWithoutResend,
  canRetryOutbound,
  outboundStatusDetail,
  outboundStatusLabel,
} from "@/lib/outbound/status-labels";

const SECRETISH =
  /password|secret|token|apikey|api_key|authorization|bearer|service_role|private[_-]?key|resend/i;

/** Mask email for trader UI: keep domain, hide local part. */
export function maskEmailAddress(email: string | null | undefined): string {
  const value = email?.trim() ?? "";
  if (!value || !value.includes("@")) return "(no email)";
  const [local, domain] = value.split("@");
  if (!domain) return "(no email)";
  const visible = local.slice(0, 1) || "*";
  return `${visible}***@${domain}`;
}

/** Strip credential-like fragments from provider errors shown to traders. */
export function sanitizeOutboundError(
  message: string | null | undefined
): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  // Keep the known local-isolation message; it may mention RESEND_API_KEY in docs.
  if (/Outbound email is blocked for local Supabase/i.test(trimmed)) {
    return "Outbound email is blocked for local Supabase.";
  }
  if (SECRETISH.test(trimmed)) {
    return "Redacted error detail";
  }
  return trimmed.slice(0, 240);
}

export function toOutboundTraderView(
  row: Pick<
    OutboundMessageRow,
    | "id"
    | "event_kind"
    | "audience"
    | "status"
    | "recipient_email"
    | "subject"
    | "attempt_at"
    | "attempt_count"
    | "provider_message_id"
    | "last_error"
    | "proposal_id"
    | "enquiry_id"
    | "visit_id"
    | "invoice_id"
  >
): OutboundTraderView {
  const hasProviderMessageId = Boolean(row.provider_message_id?.trim());
  return {
    id: row.id,
    eventKind: row.event_kind,
    audience: row.audience,
    status: row.status,
    statusLabel: outboundStatusLabel(row.status),
    statusDetail: outboundStatusDetail(row.status),
    canRetry: canRetryOutbound(row.status),
    canConfirmWithoutResend: canConfirmOutboundWithoutResend(row.status),
    needsProviderMessageId:
      row.status === "unknown" && !hasProviderMessageId,
    recipientDisplay: maskEmailAddress(row.recipient_email),
    subject: row.subject,
    attemptAt: row.attempt_at,
    attemptCount: row.attempt_count,
    hasProviderMessageId,
    lastErrorSafe: sanitizeOutboundError(row.last_error),
    proposalId: row.proposal_id,
    enquiryId: row.enquiry_id,
    visitId: row.visit_id,
    invoiceId: row.invoice_id,
  };
}
