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
import { buildPaymentPartialReceivedEmail } from "@/lib/payments/email";
import {
  buildPaymentReceivedOutboundMetadata,
  resolvePaymentReceivedSettlementForRetry,
} from "@/lib/payments/server/notify-payment";
import { formatPenceAsGbp } from "@/lib/proposals/money";

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


describe("Part 3C — retry content integrity after subsequent payment", () => {
  it("first £200 notification still shows £800 outstanding after a later £300 payment", () => {
    const invoiceTotal = 100_000;
    const firstPayment = 20_000;
    const firstOutstanding = invoiceTotal - firstPayment; // 80_000
    const secondPayment = 30_000;
    const laterOutstanding = firstOutstanding - secondPayment; // 50_000 (live)

    const meta = buildPaymentReceivedOutboundMetadata({
      paymentStatus: "partially_paid",
      amountLabel: formatPenceAsGbp(firstPayment),
      methods: ["bank_transfer"],
      ledgerPaymentId: "ledger-first-200",
      fullySettled: false,
      outstandingPence: firstOutstanding,
      amountRecordedPence: firstPayment,
    });
    expect(meta.ok).toBe(true);
    if (!meta.ok) return;

    // Simulate live invoice after second payment — must not affect retry options.
    expect(laterOutstanding).toBe(50_000);

    const settlement = resolvePaymentReceivedSettlementForRetry({
      ledgerPaymentId: "ledger-first-200",
      amountRecordedPence: meta.metadata.amount_recorded_pence,
      outstandingPence: meta.metadata.outstanding_pence,
      fullySettled: meta.metadata.fully_settled,
    });
    expect(settlement.ok).toBe(true);
    if (!settlement.ok) return;
    expect(settlement.fullySettled).toBe(false);
    expect(settlement.amountRecordedPence).toBe(20_000);
    expect(settlement.outstandingPence).toBe(80_000);

    const email = buildPaymentPartialReceivedEmail({
      businessName: "Sam Sparks",
      customerName: "Morgan",
      jobTitle: "Socket installation",
      amountLabel: formatPenceAsGbp(settlement.amountRecordedPence),
      outstandingLabel: formatPenceAsGbp(settlement.outstandingPence),
      portalToken: "token-integrity-1",
    });
    expect(email.html).toMatch(/£200\.00/);
    expect(email.html).toMatch(/£800\.00/);
    expect(email.html).not.toMatch(/£500\.00/);
    expect(email.html).not.toMatch(/paid in full/i);
  });
});

describe("Part 3C — partial metadata and missing-event safety", () => {
  it("keeps incomplete historical partials refused and does not rebuild from live balance", () => {
    const actions = readRepo("lib/outbound/actions.ts");
    expect(actions).toContain("original outstanding balance was not stored");
    expect(actions).toContain("normalizeNonNegativePence(meta.outstanding_pence)");
    expect(actions).toContain("amount_recorded_pence");
    expect(actions).toContain("stored amount does not match the ledger payment");
    // Must not assign current balance_due into older missing instalments.
    expect(actions).toContain("isLatestLedgerPaymentForMissingReconcile");
    expect(actions).toContain(
      "Skip older missing instalments — do not invent historical outstanding"
    );
  });

  it("documents that missing-event reconcile is fail-closed for older instalments", () => {
    const notify = readRepo("lib/payments/server/notify-payment.ts");
    expect(notify).toContain("isLatestLedgerPaymentForMissingReconcile");
    expect(notify).toContain(
      "Older instalment without event-time outstanding snapshot"
    );
    // Still uses balance_due only after latest-payment gate.
    const recover = notify.slice(
      notify.indexOf("export async function recoverMissingPaymentNotifications")
    );
    expect(recover).toContain("isLatestLedgerPaymentForMissingReconcile");
    expect(recover).toContain("balance_due");
  });

  it("preserves outbound retry eligibility contracts", () => {
    expect(canRetryOutbound("needed")).toBe(true);
    expect(canRetryOutbound("failed")).toBe(true);
    expect(canRetryOutbound("sending")).toBe(false);
    expect(canRetryOutbound("unknown")).toBe(false);
    expect(canRetryOutbound("provider_accepted")).toBe(false);
    expect(canRetryOutbound("simulated")).toBe(false);
  });
});
