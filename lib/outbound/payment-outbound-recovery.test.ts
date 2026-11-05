/**
 * Part 2Z — payment-only outbound recovery contracts (source + pure helpers).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parsePaymentReceivedLedgerIdFromKey,
  paymentReceivedLedgerKey,
  paymentRequestedKey,
} from "@/lib/outbound/keys";
import { canRetryOutbound } from "@/lib/outbound/status-labels";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("parsePaymentReceivedLedgerIdFromKey", () => {
  it("parses ledger keys and rejects legacy paid_at keys", () => {
    const ledgerId = "11111111-1111-4111-8111-111111111111";
    expect(
      parsePaymentReceivedLedgerIdFromKey(paymentReceivedLedgerKey(ledgerId))
    ).toBe(ledgerId);
    expect(
      parsePaymentReceivedLedgerIdFromKey(
        "payment_received/proposal-id/2026-11-05T12:00:00.000Z"
      )
    ).toBeNull();
    expect(parsePaymentReceivedLedgerIdFromKey("payment_requested/x/y")).toBeNull();
  });
});

describe("Payment-only recovery wiring (Part 2Z)", () => {
  it("proposal page loads payment outbound only and requires explicit reconcile", () => {
    const page = readRepo("app/(workspace)/proposals/[id]/page.tsx");
    expect(page).toContain("payment_requested");
    expect(page).toContain("payment_received");
    expect(page).toContain("MissingPaymentOutboundReconcile");
    expect(page).toContain("OutboundRecovery");
    expect(page).toContain("payment_request_event_id");
    expect(page).toContain("paymentRequestedKey");
    expect(page).toContain("paymentReceivedLedgerKey");
    // No page-view auto-reconcile action call.
    expect(page).not.toContain(
      "reconcileMissingPaymentOutboundForProposalAction("
    );
    expect(page).not.toContain("recoverMissingPaymentNotifications");
    // Do not pull non-payment recovery kinds into this page slice.
    expect(page).not.toContain("quote_accepted");
    expect(page).not.toContain("invoice_cancelled");
    expect(page).not.toContain("credit_note_issued");
  });

  it("retry path protects payment-received content and current request identity", () => {
    const actions = readRepo("lib/outbound/actions.ts");
    expect(actions).toContain("buildPaymentReceivedRetryOptions");
    expect(actions).toContain("parsePaymentReceivedLedgerIdFromKey");
    expect(actions).toContain("amount_pence");
    expect(actions).toContain("fully_settled");
    expect(actions).toContain("outstanding_pence");
    expect(actions).toContain(
      "Cannot safely rebuild this partial-payment email"
    );
    expect(actions).toContain(
      "not the current request identity and cannot be safely rebuilt"
    );
    expect(actions).toContain("idempotency_key !== expectedKey");
    // Distinct reconcile vs retry.
    expect(actions).toContain(
      "reconcileMissingPaymentOutboundForProposalAction"
    );
    expect(actions).toContain("retryOutboundMessageAction");
  });

  it("documents retry eligibility aligned with committed state machine", () => {
    expect(canRetryOutbound("needed")).toBe(true);
    expect(canRetryOutbound("failed")).toBe(true);
    expect(canRetryOutbound("sending")).toBe(false);
    expect(canRetryOutbound("unknown")).toBe(false);
    expect(canRetryOutbound("provider_accepted")).toBe(false);
    expect(canRetryOutbound("simulated")).toBe(false);
    expect(
      paymentRequestedKey("prop", "evt-12345678").startsWith("payment_requested/")
    ).toBe(true);
  });
});
