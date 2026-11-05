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

describe("Payment notification email templates", () => {
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
  });
});

describe("Outbound payment notification keys", () => {
  it("uses stable request and ledger payment keys", () => {
    const requestId = "req-uuid-1";
    const otherRequestId = "req-uuid-2";
    const paidAt = "2026-11-03T23:10:00.000Z";
    const ledgerId = "pay-ledger-uuid-1";
    expect(paymentRequestedKey("prop-1", requestId)).toBe(
      `payment_requested/prop-1/${requestId}`
    );
    expect(paymentRequestedKey("prop-1", requestId)).toBe(
      paymentRequestedKey("prop-1", requestId)
    );
    expect(paymentRequestedKey("prop-1", otherRequestId)).not.toBe(
      paymentRequestedKey("prop-1", requestId)
    );
    expect(paymentReceivedLedgerKey(ledgerId)).toBe(
      `payment_received/${ledgerId}`
    );
    expect(paymentReceivedKey("prop-1", paidAt)).toBe(
      `payment_received/prop-1/${paidAt}`
    );
  });
});

describe("Thin Payment Requested — durable wiring (source inspection)", () => {
  it("wires safeNotifyPaymentRequested with requestEventId after financial save", () => {
    const actions = readRepo("lib/payments/actions.ts");
    const request = actions.slice(
      actions.indexOf("export async function requestJobPaymentAction"),
      actions.indexOf("export async function recordInvoicePaymentAction")
    );

    expect(request).toContain("safeNotifyPaymentRequested");
    expect(request).toContain("requestEventId");
    expect(request).toContain("loadProposalInvoicePresence");
    expect(request).toContain("balance_due");
    expect(request).toContain("amount_paid");
    expect(request).toContain('partially_paid');
    expect(request).toContain("cancelledPendingReplacement");
    expect(request).not.toContain("sendNotificationEmail");
    expect(request).not.toContain("buildPaymentRequestedEmail");
    expect(request).not.toContain("record_invoice_payment");
    expect(request).not.toContain('status: "closed"');
    expect(request).toMatch(/Payment request saved\. The email could not be sent/);
    expect(request).toContain("already_terminal");

    // Cap above outstanding balance
    expect(request).toMatch(/Request cannot be more than the outstanding balance/);
    expect(request).toMatch(/There is no outstanding balance to request/);

    const notify = readRepo("lib/payments/server/notify-payment.ts");
    expect(notify).toContain("paymentRequestedKey");
    expect(notify).toContain("enqueueAndDeliverOutboundMessage");
    expect(notify).toContain("findOutboundByIdempotencyKey");
    expect(notify).toContain("already_terminal");
    expect(notify).toContain('eventKind: kind');

    const ui = readRepo("components/jobs/completed-job-payment.tsx");
    expect(ui).toContain('name="requestEventId"');
    expect(ui).toContain("crypto.randomUUID()");
    expect(ui).not.toContain("credit-notes");
    expect(ui).not.toContain("components/outbound");

    // Received path remains durable; request path no longer uses direct send.
    expect(actions).toContain("safeNotifyPaymentReceived");
    expect(actions).not.toContain("sendNotificationEmail");
    expect(actions).not.toContain("@/lib/outbound/actions");
  });

  it("keeps payment-received ledger key preference", () => {
    const notify = readRepo("lib/payments/server/notify-payment.ts");
    expect(notify).toContain("paymentReceivedLedgerKey(ledgerPaymentId)");
    expect(notify).toContain("paymentReceivedKey(proposal.id, eventVersion)");
  });
});
