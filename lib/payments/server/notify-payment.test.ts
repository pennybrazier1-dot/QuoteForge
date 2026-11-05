import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPaymentPartialReceivedEmail,
  buildPaymentReceivedEmail,
  buildPaymentRequestedEmail,
  emailContainsBankDetails,
} from "@/lib/payments/email";
import {
  paymentReceivedKey,
  paymentReceivedLedgerKey,
  paymentRequestedKey,
} from "@/lib/outbound/keys";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Thin Payment Received — email templates", () => {
  it("keeps bank details out of payment-request email", () => {
    const email = buildPaymentRequestedEmail({
      businessName: "Sam Sparks E2E Ltd",
      customerName: "Morgan Pay9G6",
      jobTitle: "Socket installation",
      amountLabel: "£275.00",
      methods: ["bank_transfer"],
      portalToken: "9g6paytoken00000000000000000000000000000000001",
    });
    expect(email.heading).toBe("Payment requested");
    expect(email.ctaUrl).toContain("/p/9g6paytoken");
    expect(
      emailContainsBankDetails(email.html, {
        sortCode: "12-34-56",
        accountNumber: "12345678",
      })
    ).toBe(false);
  });

  it("builds fully-paid confirmation without implying bank clearance", () => {
    const email = buildPaymentReceivedEmail({
      businessName: "Sam Sparks E2E Ltd",
      customerName: "Morgan",
      jobTitle: "Socket installation",
      amountLabel: "£275.00",
      portalToken: "9g6paytoken00000000000000000000000000000000001",
      fullyPaid: true,
    });
    expect(email.heading).toBe("Paid in full");
    expect(email.html).toMatch(/paid in full/i);
    expect(email.html).not.toMatch(/cleared the bank|funds cleared/i);
  });

  it("builds partial payment confirmation without saying fully paid", () => {
    const email = buildPaymentPartialReceivedEmail({
      businessName: "Sam Sparks E2E Ltd",
      customerName: "Morgan",
      jobTitle: "Socket installation",
      amountLabel: "£600.00",
      outstandingLabel: "£1,800.00",
      portalToken: "9g6paytoken00000000000000000000000000000000001",
    });
    expect(email.heading).toBe("Payment recorded");
    expect(email.html).toMatch(/£600\.00/);
    expect(email.html).toMatch(/£1,800\.00/);
    expect(email.html).toMatch(/remains outstanding/i);
    expect(email.html).not.toMatch(/paid in full/i);
    expect(email.html).toMatch(/recorded by your trader/i);
  });
});

describe("Thin Payment Received — outbound keys and durable wiring", () => {
  it("uses stable ledger payment keys (preferred) and legacy paid-at fallback", () => {
    const paidAt = "2026-11-03T23:10:00.000Z";
    const ledgerId = "pay-ledger-uuid-1";
    expect(paymentReceivedLedgerKey(ledgerId)).toBe(
      `payment_received/${ledgerId}`
    );
    expect(paymentReceivedKey("prop-1", paidAt)).toBe(
      `payment_received/prop-1/${paidAt}`
    );
    // Request keys remain available on foundation; this batch does not migrate request path.
    expect(paymentRequestedKey("prop-1", "req-uuid-1")).toBe(
      `payment_requested/prop-1/req-uuid-1`
    );
  });

  it("wires durable payment-received notify after financial saves (not on view)", () => {
    const notify = readRepo("lib/payments/server/notify-payment.ts");
    expect(notify).toContain("enqueueAndDeliverOutboundMessage");
    expect(notify).toContain("findOutboundByIdempotencyKey");
    expect(notify).toContain("paymentReceivedLedgerKey");
    expect(notify).toContain("ledgerPaymentId");
    expect(notify).toContain("buildPaymentReceivedEmail");
    expect(notify).toContain("buildPaymentPartialReceivedEmail");
    expect(notify).toContain('sourceType: "proposal_payment"');
    expect(notify).toContain('audience: "customer"');
    expect(notify).toContain("already_terminal");
    expect(notify).toMatch(/Never throws into the trader action/i);
    expect(notify).toMatch(/never bank account numbers, portal tokens/i);
    // Recovery helpers may remain present but unwired in this batch.
    expect(notify).toContain("recoverMissingPaymentNotifications");
    expect(notify).toContain("buildPaymentRetryPayload");

    const actions = readRepo("lib/payments/actions.ts");
    expect(actions).toContain("safeNotifyPaymentReceived");
    expect(actions).toContain("ledgerPaymentId");

    const markPaid = actions.slice(
      actions.indexOf("export async function markJobPaidAction"),
      actions.indexOf("export async function waiveJobPaymentAction")
    );
    expect(markPaid).toContain("safeNotifyPaymentReceived");
    expect(markPaid).not.toContain('status: "closed"');

    const record = actions.slice(
      actions.indexOf("export async function recordInvoicePaymentAction"),
      actions.indexOf("export async function markJobPaidAction")
    );
    expect(record).toContain("safeNotifyPaymentReceived");
    expect(record).toContain("parsed.payment_id");
    expect(record).toContain("parsed.amount_recorded");
    expect(record).toContain("parsed.fully_settled");
    // Failure after success → warning, not payment error rollback.
    expect(record).toMatch(/Payment recorded\. The confirmation email could not be sent/);

    // Payment-requested migration is explicitly out of this batch.
    expect(actions).toContain("sendNotificationEmail");
    expect(actions).toContain("buildPaymentRequestedEmail");
    expect(actions).not.toContain("safeNotifyPaymentRequested");

    // Waive must not send payment-received notifications.
    const waive = actions.slice(
      actions.indexOf("export async function waiveJobPaymentAction"),
      actions.indexOf("export async function closeJobAction")
    );
    expect(waive).not.toContain("safeNotifyPaymentReceived");

    // No dashboard / outbound recovery UI in this candidate.
    expect(notify).not.toContain("components/outbound");
    expect(actions).not.toContain("@/lib/outbound/actions");
  });

  it("prefers ledger id key and uses legacy paid-at only without ledger id", () => {
    const notify = readRepo("lib/payments/server/notify-payment.ts");
    expect(notify).toContain("paymentReceivedLedgerKey(ledgerPaymentId)");
    expect(notify).toContain("paymentReceivedKey(proposal.id, eventVersion)");
    expect(notify).toMatch(/Legacy \/ no-invoice settlement path/);
  });
});
