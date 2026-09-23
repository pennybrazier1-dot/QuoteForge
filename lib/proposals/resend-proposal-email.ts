import { canResendProposalEmail } from "@/lib/proposals/proposal-email-delivery";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export const RESEND_SUCCESS_COPY = "✓ Email resent";
export const RESEND_FAILURE_COPY =
  "Couldn't resend the email. Please try again.";
export const RESEND_PENDING_COPY = "Sending…";

const TOKEN_PATH = /\/p\/[A-Za-z0-9_-]+/gi;
const TOKEN_FIELD =
  /(customer_access_token|portal_url|ctaUrl|token)[=:]\s*\S+/gi;
const SECRET_FIELD =
  /(api[_-]?key|authorization|secret|password|bearer)[=:]\s*\S+/gi;
const BANK_FIELD =
  /(sort[_\s-]?code|account[_\s-]?number|iban|bank[_\s-]?details?)[=:]\s*\S+/gi;
const PAYMENT_FIELD =
  /(card[_\s-]?number|payment[_\s-]?url|issued_bank_[a-z_]+)[=:]\s*\S+/gi;

/** Resend is a communication action only. Never offered on booked/completed/closed. */
export function canOfferProposalResend(status: string): boolean {
  return canResendProposalEmail(status);
}

export function resendKeepsTraderOnSamePage(): boolean {
  return true;
}

export function reminderResendMustReusePortalToken(): boolean {
  return true;
}

export function planProposalResend(status: string): {
  allowed: boolean;
  kind: "reminder" | "revised" | null;
  staysOnPage: true;
  rotatesPortalToken: false;
  createsCustomer: false;
  createsProposal: false;
  createsJob: false;
  changesBookingState: false;
  revalidateOnlyProposalPage: true;
} {
  const normalized = normalizeProposalStatus(status);
  const allowed = canResendProposalEmail(normalized);
  return {
    allowed,
    kind: !allowed
      ? null
      : normalized === "waiting_for_customer"
        ? "reminder"
        : "revised",
    staysOnPage: true,
    rotatesPortalToken: false,
    createsCustomer: false,
    createsProposal: false,
    createsJob: false,
    changesBookingState: false,
    revalidateOnlyProposalPage: true,
  };
}

export function redactResendLogText(value: string): string {
  return value
    .replace(TOKEN_PATH, "/p/[redacted]")
    .replace(TOKEN_FIELD, "$1=[redacted]")
    .replace(SECRET_FIELD, "$1=[redacted]")
    .replace(BANK_FIELD, "$1=[redacted]")
    .replace(PAYMENT_FIELD, "$1=[redacted]");
}

/** Server diagnostics for a failed resend. Never logs tokens, bank, or secrets. */
export function logResendFailure(
  error: unknown,
  context: { proposalId?: string; status?: string }
): void {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown_error";
  console.error("[resend-proposal-email]", {
    proposalId: context.proposalId || null,
    status: context.status || null,
    error: redactResendLogText(raw),
  });
}
