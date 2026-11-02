/**
 * Secure diagnostics for invoice draft creation failures.
 * Never logs secrets, credentials, env values, or full customer PII dumps.
 */

export type InvoiceFailureCategory =
  | "proposal_missing"
  | "number_allocation_failed"
  | "insert_failed"
  | "unique_race_unresolved"
  | "unknown";

export type InvoiceFailureLogInput = {
  proposalId: string;
  workspaceId: string;
  category: InvoiceFailureCategory;
  message?: string | null;
  at?: string;
};

const SECRETISH =
  /password|secret|token|apikey|api_key|authorization|bearer|service_role|private[_-]?key/i;

/** Strip anything that looks like a credential fragment from error text. */
export function sanitizeInvoiceFailureMessage(
  message: string | null | undefined
): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (SECRETISH.test(trimmed)) {
    return "Redacted error detail";
  }
  // Keep short — avoid dumping large payloads.
  return trimmed.slice(0, 240);
}

export function categorizeInvoiceFailure(
  message: string | null | undefined
): InvoiceFailureCategory {
  const text = (message ?? "").toLowerCase();
  if (!text) return "unknown";
  if (text.includes("proposal not found")) return "proposal_missing";
  if (text.includes("allocate invoice number") || text.includes("not authorised")) {
    return "number_allocation_failed";
  }
  if (text.includes("duplicate") || text.includes("unique")) {
    return "unique_race_unresolved";
  }
  if (text.includes("could not create invoice")) return "insert_failed";
  return "unknown";
}

export function logInvoiceDraftFailure(input: InvoiceFailureLogInput): void {
  const at = input.at ?? new Date().toISOString();
  console.error("[invoice-draft-failed]", {
    proposalId: input.proposalId,
    workspaceId: input.workspaceId,
    category: input.category,
    message: sanitizeInvoiceFailureMessage(input.message),
    at,
  });
}
