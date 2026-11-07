import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { describeRehearsalDb } from "@/lib/testing/rehearsal-db";
import {
  buildInvoiceIssuedEmail,
  canShowInvoiceEmailButton,
  describeInvoiceEmailFeedback,
} from "@/lib/invoices/email-issued";
import { parseInvoiceRow } from "@/lib/invoices/parse";
import { OUTBOUND_PROVIDER_ACCEPTED_NOTE } from "@/lib/outbound/types";

const sendEmailMock = vi.hoisted(() => vi.fn());
const pdfMock = vi.hoisted(() => vi.fn());
const loadInvoiceMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const recordEventMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/onboarding/status", () => ({
  userHasProfile: vi.fn(async () => true),
}));
vi.mock("@/lib/proposals/record-proposal-event", () => ({
  recordProposalEvent: recordEventMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/invoices/ensure-draft", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices/ensure-draft")>(
    "@/lib/invoices/ensure-draft"
  );
  return { ...actual, loadInvoiceForProposal: loadInvoiceMock };
});
vi.mock("@/lib/invoices/pdf/load-invoice-pdf", () => ({
  generateInvoicePdfBufferForInvoice: pdfMock,
}));
vi.mock("@/lib/email/send-notification-email", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/email/send-notification-email")
  >("@/lib/email/send-notification-email");
  return { ...actual, sendNotificationEmail: sendEmailMock };
});

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_WS = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPOSAL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const INVOICE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TOKEN = "0123456789abcdef0123456789abcdef";

function readRepo(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE,
    workspace_id: WS,
    proposal_id: PROPOSAL,
    customer_id: null,
    job_id: null,
    invoice_number: "INV-2026-0009",
    status: "approved",
    currency: "GBP",
    business_name: "Frozen Snapshot Ltd",
    issued_address_line_1: "1 Frozen Yard",
    issued_address_line_2: null,
    issued_town: "Bristol",
    issued_county: null,
    issued_postcode: "BS1 1AA",
    issued_phone: "01000 000000",
    issued_email: "accounts@frozen.example",
    issued_vat_number: "GB111111111",
    issued_website: null,
    issued_company_number: null,
    issued_logo_path: null,
    business_snapshot_at: "2026-11-06T08:00:00.000Z",
    customer_name: "Morgan Pricecheck",
    customer_email: "morgan@example.test",
    customer_phone: null,
    customer_address: "12 Example Road",
    job_title: "Kitchen refresh",
    job_address: "12 Example Road",
    work_description: "Refresh kitchen units",
    line_items: [
      {
        id: "line-1",
        kind: "labour",
        description: "Labour",
        quantity: 1,
        unit_amount: 200000,
        total_amount: 200000,
        pricing_state: "priced",
      },
    ],
    flags: [],
    notes: null,
    subtotal_amount: 200000,
    vat_amount: 40000,
    total_amount: 240000,
    amount_paid: 0,
    balance_due: 240000,
    agreed_total_amount: 240000,
    source_vat_amount: 40000,
    adjustment_confirmed: false,
    tax_confirmed: true,
    created_by: USER,
    approved_by: USER,
    created_at: "2026-11-06T08:00:00.000Z",
    updated_at: "2026-11-06T08:00:00.000Z",
    approved_at: "2026-11-06T08:00:00.000Z",
    opening_amount_paid: 0,
    ...overrides,
  };
}

type OutboundRow = {
  id: string;
  workspace_id: string;
  event_kind: string;
  audience: string;
  source_type: string;
  source_id: string;
  proposal_id: string | null;
  invoice_id: string | null;
  recipient_email: string;
  subject: string | null;
  status: string;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  attempt_count: number;
};

function createHarness(row = invoiceRow()) {
  const proposal = {
    id: PROPOSAL,
    customer_access_token: TOKEN,
  };
  const workspace = {
    id: WS,
    business_name: "Live Business Should Not Be Used",
    contact_email: "trader@example.test",
  };
  const profile = { id: USER, workspace_id: WS };
  const outbound: OutboundRow[] = [];
  let invoiceUpdates = 0;
  let proposalUpdates = 0;
  let seq = 0;

  function rowsFor(table: string): Record<string, unknown>[] {
    if (table === "invoices") return [row];
    if (table === "proposals") return [proposal];
    if (table === "workspaces") return [workspace];
    if (table === "profiles") return [profile];
    if (table === "outbound_messages") return outbound;
    return [];
  }

  function from(table: string) {
    const filters: { col: string; val: unknown }[] = [];
    let pendingUpdate: Record<string, unknown> | null = null;
    const api = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return api;
      },
      update(payload: Record<string, unknown>) {
        pendingUpdate = payload;
        return api;
      },
      maybeSingle: async () => {
        if (pendingUpdate) {
          if (table === "invoices") invoiceUpdates += 1;
          if (table === "proposals") {
            proposalUpdates += 1;
            Object.assign(proposal, pendingUpdate);
          }
          return { data: null, error: null };
        }
        const match = rowsFor(table).find((item) =>
          filters.every((filter) => item[filter.col] === filter.val)
        );
        return { data: match ?? null, error: null };
      },
    };
    return api;
  }

  function rpc(name: string, args: Record<string, unknown>) {
    if (name === "enqueue_outbound_message") {
      const key = String(args.p_idempotency_key);
      const existing = outbound.find(
        (item) =>
          item.workspace_id === args.p_workspace_id &&
          item.idempotency_key === key
      );
      if (existing) {
        return Promise.resolve({
          data: {
            ok: true,
            created: false,
            id: existing.id,
            status: existing.status,
          },
          error: null,
        });
      }
      seq += 1;
      const created: OutboundRow = {
        id: `outbound-${seq}`,
        workspace_id: String(args.p_workspace_id),
        event_kind: String(args.p_event_kind),
        audience: String(args.p_audience),
        source_type: String(args.p_source_type),
        source_id: String(args.p_source_id),
        proposal_id: (args.p_proposal_id as string | null) ?? null,
        invoice_id: (args.p_invoice_id as string | null) ?? null,
        recipient_email: String(args.p_recipient_email),
        subject: (args.p_subject as string | null) ?? null,
        status: "needed",
        idempotency_key: key,
        metadata: (args.p_metadata as Record<string, unknown>) ?? {},
        attempt_count: 0,
      };
      outbound.push(created);
      return Promise.resolve({
        data: { ok: true, created: true, id: created.id, status: "needed" },
        error: null,
      });
    }

    if (name === "claim_outbound_message") {
      const current = outbound.find((item) => item.id === args.p_message_id);
      if (!current || (current.status !== "needed" && current.status !== "failed")) {
        return Promise.resolve({
          data: {
            ok: false,
            id: current?.id,
            status: current?.status ?? "unknown",
            reason:
              current?.status === "unknown" || current?.status === "sending"
                ? "Delivery outcome is unsettled. Confirm the provider message id without resending."
                : "Notification cannot be claimed in its current state.",
          },
          error: null,
        });
      }
      current.status = "sending";
      current.attempt_count += 1;
      return Promise.resolve({
        data: {
          ok: true,
          id: current.id,
          status: "sending",
          idempotency_key: current.idempotency_key,
          recipient_email: current.recipient_email,
          subject: current.subject,
        },
        error: null,
      });
    }

    if (name === "settle_outbound_message") {
      const current = outbound.find((item) => item.id === args.p_message_id);
      if (!current) {
        return Promise.resolve({
          data: { ok: false, reason: "missing" },
          error: null,
        });
      }
      current.status = String(args.p_status);
      return Promise.resolve({
        data: { ok: true, id: current.id, status: current.status },
        error: null,
      });
    }

    return Promise.resolve({
      data: { ok: false, reason: `unexpected rpc ${name}` },
      error: null,
    });
  }

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: USER } } }),
    },
    from,
    rpc,
  };

  return {
    supabase,
    outbound,
    get invoiceUpdates() {
      return invoiceUpdates;
    },
    get proposalUpdates() {
      return proposalUpdates;
    },
    row,
  };
}

function formFor(extra?: Record<string, string>) {
  const form = new FormData();
  form.set("proposalId", PROPOSAL);
  form.set("invoiceId", INVOICE);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
  }
  return form;
}

describe("explicit invoice email", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    pdfMock.mockReset();
    loadInvoiceMock.mockReset();
    createClientMock.mockReset();
    recordEventMock.mockReset();
    sendEmailMock.mockResolvedValue({
      ok: true,
      messageId: "re_test_double_not_a_provider",
    });
    pdfMock.mockImplementation(async (_supabase, invoice) => ({
      ok: true,
      buffer: Buffer.from(
        `PDF ${invoice.invoice_number} ${invoice.business_name} ${invoice.total_amount} ${invoice.vat_amount} ${invoice.balance_due}`
      ),
      fileName: `${invoice.invoice_number}.pdf`,
      invoice,
    }));
    recordEventMock.mockResolvedValue(undefined);
  });

  it("keeps approval from sending and keeps the PDF call on the committed renderer", async () => {
    const { approveInvoiceAction } = await import("@/lib/invoices/actions");
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);
    const approved = parseInvoiceRow(harness.row);
    loadInvoiceMock.mockResolvedValue(approved);

    const approvedAgain = await approveInvoiceAction({}, formFor());
    expect(approvedAgain.success).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(pdfMock).not.toHaveBeenCalled();
    expect(harness.outbound).toHaveLength(0);

    const actions = readRepo("lib/invoices/actions.ts");
    const approveIdx = actions.indexOf("export async function approveInvoiceAction");
    const sendIdx = actions.indexOf("export async function sendInvoiceEmailAction");
    const approveBlock = actions.slice(approveIdx, sendIdx);
    expect(approveBlock).toContain("email_sent: false");
    expect(approveBlock).not.toContain("notifyCustomerOfInvoiceIssued");
    expect(approveBlock).not.toContain("sendNotificationEmail");
    expect(readRepo("lib/invoices/server/notify-invoice-issued.ts")).toContain(
      "generateInvoicePdfBufferForInvoice"
    );
  });

  it("refuses a draft and a missing or invalid recipient without sending", async () => {
    const { sendInvoiceEmailAction } = await import("@/lib/invoices/actions");
    const { notifyCustomerOfInvoiceIssued } = await import(
      "@/lib/invoices/server/notify-invoice-issued"
    );
    const harness = createHarness(invoiceRow({ status: "draft" }));
    createClientMock.mockResolvedValue(harness.supabase);
    loadInvoiceMock.mockResolvedValue(parseInvoiceRow(harness.row));

    const draft = await sendInvoiceEmailAction({}, formFor());
    expect(draft.error).toMatch(/Approve the invoice/i);
    expect(sendEmailMock).not.toHaveBeenCalled();

    const missing = await notifyCustomerOfInvoiceIssued(
      createHarness(invoiceRow({ customer_email: "  " })).supabase as never,
      INVOICE,
      WS
    );
    expect(missing.ok && missing.skipped).toBe("no_recipient");

    const invalid = await notifyCustomerOfInvoiceIssued(
      createHarness(invoiceRow({ customer_email: "not-an-email" })).supabase as never,
      INVOICE,
      WS
    );
    expect(invalid.ok && invalid.skipped).toBe("no_recipient");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("emails the saved customer with the frozen invoice PDF and portal link", async () => {
    const { sendInvoiceEmailAction } = await import("@/lib/invoices/actions");
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);
    loadInvoiceMock.mockResolvedValue(parseInvoiceRow(harness.row));

    const result = await sendInvoiceEmailAction(
      {},
      formFor({ customerEmail: "attacker@evil.test" })
    );

    expect(result.success).toBe(true);
    expect(result.emailDelivery?.providerAccepted).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sent = sendEmailMock.mock.calls[0][0];
    expect(sent.to).toBe("morgan@example.test");
    expect(sent.subject).toBe("Invoice INV-2026-0009 from Frozen Snapshot Ltd");
    expect(sent.subject).not.toContain("Live Business Should Not Be Used");
    expect(sent.attachments[0].filename).toBe("INV-2026-0009.pdf");
    expect(sent.attachments[0].content.toString()).toContain("Frozen Snapshot Ltd");
    expect(sent.attachments[0].content.toString()).toContain("240000");
    expect(sent.attachments[0].content.toString()).toContain("40000");
    expect(sent.html).toContain(`/p/${TOKEN}`);
    expect(sent.html).toContain(`/p/${TOKEN}/invoice/pdf`);
    expect(sent.message).toContain(
      "Amount due: £2,400.00. This email does not confirm that a payment has been received."
    );
    expect(sent.message).not.toContain("Balance still to pay");
    expect(sent.html).toContain("does not confirm that a payment has been received");
    expect(sent.html).not.toContain("We have received your payment");
    expect(JSON.stringify(harness.outbound[0].metadata)).not.toContain(TOKEN);
    const event = recordEventMock.mock.calls[0][1] as {
      metadata: Record<string, unknown>;
    };
    expect(JSON.stringify(event.metadata)).not.toContain(TOKEN);
    expect(event.metadata.marked_paid).toBe(false);
    expect(harness.invoiceUpdates).toBe(0);
    expect(harness.proposalUpdates).toBe(0);
    expect(pdfMock).toHaveBeenCalledWith(harness.supabase, expect.objectContaining({
      business_name: "Frozen Snapshot Ltd",
      total_amount: 240000,
      vat_amount: 40000,
      balance_due: 240000,
    }));
  });

  it("refuses another workspace and refuses to confirm a changed invoice", async () => {
    const { sendInvoiceEmailAction } = await import("@/lib/invoices/actions");
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);
    loadInvoiceMock.mockResolvedValueOnce(null);

    const missing = await sendInvoiceEmailAction({}, formFor());
    expect(missing.error).toBe("Invoice not found.");
    expect(sendEmailMock).not.toHaveBeenCalled();

    const other = await import("@/lib/invoices/server/notify-invoice-issued");
    const skipped = await other.notifyCustomerOfInvoiceIssued(
      harness.supabase as never,
      INVOICE,
      OTHER_WS
    );
    expect(skipped.ok && skipped.skipped).toBe("not_notifiable");

    loadInvoiceMock.mockResolvedValueOnce(parseInvoiceRow(harness.row));
    loadInvoiceMock.mockResolvedValueOnce(
      parseInvoiceRow({ ...harness.row, total_amount: 1 })
    );
    const changed = await sendInvoiceEmailAction({}, formFor());
    expect(changed.error).toMatch(/changed unexpectedly/i);
    expect(recordEventMock).not.toHaveBeenCalled();
  });

  it("skips a second accepted send and lets only one concurrent claim send", async () => {
    const { notifyCustomerOfInvoiceIssued } = await import(
      "@/lib/invoices/server/notify-invoice-issued"
    );
    const harness = createHarness();
    const first = await notifyCustomerOfInvoiceIssued(
      harness.supabase as never,
      INVOICE,
      WS
    );
    const second = await notifyCustomerOfInvoiceIssued(
      harness.supabase as never,
      INVOICE,
      WS
    );
    expect(first.ok && !first.skipped && first.delivery.providerAccepted).toBe(true);
    expect(second.ok && second.skipped).toBe("already_terminal");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(harness.outbound).toHaveLength(1);
    expect(harness.outbound[0].status).toBe("provider_accepted");

    const race = createHarness();
    const [left, right] = await Promise.all([
      notifyCustomerOfInvoiceIssued(race.supabase as never, INVOICE, WS),
      notifyCustomerOfInvoiceIssued(race.supabase as never, INVOICE, WS),
    ]);
    const outcomes = [left, right];
    const accepted = outcomes.filter(
      (item) => item.ok && !item.skipped && item.delivery.ok
    );
    const blocked = outcomes.filter(
      (item) => item.ok && !item.skipped && item.delivery.unknownOutcome
    );
    expect(accepted).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(race.outbound).toHaveLength(1);
  });

  it("does not resend an unknown outcome and does retry a failed send once", async () => {
    const { notifyCustomerOfInvoiceIssued } = await import(
      "@/lib/invoices/server/notify-invoice-issued"
    );
    const unknownHarness = createHarness();
    sendEmailMock.mockRejectedValueOnce(new Error("provider timeout"));
    const crashed = await notifyCustomerOfInvoiceIssued(
      unknownHarness.supabase as never,
      INVOICE,
      WS
    );
    expect(crashed.ok && !crashed.skipped && crashed.delivery.unknownOutcome).toBe(
      true
    );
    expect(unknownHarness.outbound[0].status).toBe("unknown");
    const again = await notifyCustomerOfInvoiceIssued(
      unknownHarness.supabase as never,
      INVOICE,
      WS
    );
    expect(again.ok && !again.skipped && again.delivery.unknownOutcome).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    sendEmailMock.mockResolvedValueOnce({ ok: false, error: "provider refused" });
    sendEmailMock.mockResolvedValueOnce({
      ok: true,
      messageId: "re_retry_double_not_a_provider",
    });
    const failedHarness = createHarness();
    const failed = await notifyCustomerOfInvoiceIssued(
      failedHarness.supabase as never,
      INVOICE,
      WS
    );
    expect(failed.ok && !failed.skipped && failed.delivery.status).toBe("failed");
    const retried = await notifyCustomerOfInvoiceIssued(
      failedHarness.supabase as never,
      INVOICE,
      WS
    );
    expect(retried.ok && !retried.skipped && retried.delivery.providerAccepted).toBe(
      true
    );
    expect(failedHarness.outbound).toHaveLength(1);
    expect(failedHarness.outbound[0].status).toBe("provider_accepted");
    expect(sendEmailMock).toHaveBeenCalledTimes(3);
  });

  it("describes provider acceptance without claiming the customer opened the email", () => {
    const accepted = describeInvoiceEmailFeedback({
      providerAccepted: true,
      status: "provider_accepted",
    });
    expect(accepted?.title).toBe("Provider accepted");
    expect(accepted?.detail).toBe(OUTBOUND_PROVIDER_ACCEPTED_NOTE);
    expect(accepted?.detail).toMatch(/not proof/i);
    expect(accepted?.title).not.toMatch(/delivered|opened/i);

    const already = describeInvoiceEmailFeedback({ skipped: "already_terminal" });
    expect(already?.title).toBe("Already accepted by the provider");
    expect(already?.detail).toBe(OUTBOUND_PROVIDER_ACCEPTED_NOTE);

    const unknown = describeInvoiceEmailFeedback({
      unknownOutcome: true,
      status: "unknown",
    });
    expect(unknown?.detail).toMatch(/Do not resend/i);

    const failed = describeInvoiceEmailFeedback({ status: "failed" });
    expect(failed?.detail).toMatch(/retry/i);

    const missing = describeInvoiceEmailFeedback({ skipped: "no_recipient" });
    expect(missing?.detail).toMatch(/No email was sent/);

    expect(
      canShowInvoiceEmailButton({
        status: "draft",
        customerEmail: "morgan@example.test",
      })
    ).toBe(false);
    expect(
      canShowInvoiceEmailButton({
        status: "approved",
        customerEmail: "morgan@example.test",
        outboundStatus: "provider_accepted",
      })
    ).toBe(false);
    expect(
      canShowInvoiceEmailButton({
        status: "approved",
        customerEmail: "morgan@example.test",
        outboundStatus: "failed",
      })
    ).toBe(true);
    expect(
      canShowInvoiceEmailButton({
        status: "approved",
        customerEmail: "",
      })
    ).toBe(false);

    const email = buildInvoiceIssuedEmail({
      businessName: "Frozen Snapshot Ltd",
      customerName: "Morgan Pricecheck",
      jobTitle: "Kitchen refresh",
      invoiceNumber: "INV-2026-0009",
      totalAmount: 240000,
      amountPaid: 0,
      balanceDue: 240000,
      portalToken: TOKEN,
    });
    expect(email.subject).toContain("INV-2026-0009");
    expect(email.text).toContain(
      "Amount due: £2,400.00. This email does not confirm that a payment has been received."
    );
    expect(email.text).not.toContain("Balance still to pay");
    expect(email.text).not.toContain("We have received your payment");

    const screen = readRepo("components/invoices/invoice-review-screen.tsx");
    expect(screen).toContain("Email invoice to customer");
    expect(screen).toContain("Preview PDF");
    expect(screen).toContain("Invoice approved. No email was sent.");
    expect(screen).toContain("Payments recorded");
    expect(screen).not.toMatch(/credit-note|refund|waiver|amount_waived/i);
  });

  it("does not import excluded invoice features or log the portal token", () => {
    const files = [
      "lib/invoices/email-issued.ts",
      "lib/invoices/server/notify-invoice-issued.ts",
      "lib/invoices/actions.ts",
      "components/invoices/invoice-review-screen.tsx",
    ];
    for (const file of files) {
      const source = readRepo(file);
      expect(source).not.toMatch(
        /credit-notes|notify-credit-note|refunds|amount_waived|amount_credited|buildInvoiceCancelledEmail|recoverMissingInvoiceIssuedNotifications/
      );
    }
    const notify = readRepo("lib/invoices/server/notify-invoice-issued.ts");
    expect(notify).toContain('from "@/lib/invoices/current-invoice"');
    expect(notify).not.toContain("console.log");
    expect(notify).toContain("error instanceof Error ? error.message");
    expect(notify).not.toMatch(/console\.(log|warn|info)\([^)]*token/i);
    expect(notify).toContain("invoiceIssuedKey(invoice.id)");
    expect(readRepo("app/(workspace)/dashboard/page.tsx")).not.toContain(
      "recoverMissingInvoiceIssuedNotifications"
    );
    const portal = readRepo("lib/invoices/pdf/load-invoice-pdf.ts");
    const publicFn = portal.slice(
      portal.indexOf("export async function generatePublicInvoicePdfBuffer")
    );
    expect(publicFn).toContain('.eq("status", "approved")');
    expect(publicFn).not.toContain("allowDraft: true");
    expect(portal).toContain('draftWatermark: invoice.status === "draft"');
  });

  it("uses a test double and does not call Resend", () => {
    expect(Boolean(process.env.RESEND_API_KEY?.trim())).toBe(false);
    expect(process.env.REANVIL_ALLOW_LOCAL_OUTBOUND).not.toBe("1");
    expect(sendEmailMock.getMockImplementation()?.toString()).not.toContain(
      "emails.send"
    );
  });

  it("does not send again after a simulated invoice email", async () => {
    const { notifyCustomerOfInvoiceIssued } = await import(
      "@/lib/invoices/server/notify-invoice-issued"
    );
    const { enqueueOutboundMessage } = await import("@/lib/outbound/rpc");
    const { simulateOutboundDelivery } = await import("@/lib/outbound/deliver");
    const { invoiceIssuedKey } = await import("@/lib/outbound/keys");
    const { outboundStatusLabel } = await import("@/lib/outbound/status-labels");

    const harness = createHarness();
    const enqueued = await enqueueOutboundMessage(harness.supabase as never, {
      workspaceId: WS,
      eventKind: "invoice_issued",
      audience: "customer",
      sourceType: "invoice",
      sourceId: INVOICE,
      recipientEmail: "morgan@example.test",
      idempotencyKey: invoiceIssuedKey(INVOICE),
      subject: "Invoice INV-2026-0009 from Frozen Snapshot Ltd",
      proposalId: PROPOSAL,
      invoiceId: INVOICE,
    });
    expect(enqueued.ok).toBe(true);
    expect(enqueued.id).toBeTruthy();

    const simulated = await simulateOutboundDelivery(
      harness.supabase as never,
      enqueued.id as string
    );
    expect(simulated.ok).toBe(true);
    expect(simulated.simulated).toBe(true);
    expect(simulated.status).toBe("simulated");
    expect(outboundStatusLabel("simulated")).toBe("Simulated (no email sent)");
    expect(harness.outbound).toHaveLength(1);
    expect(harness.outbound[0].status).toBe("simulated");
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(pdfMock).not.toHaveBeenCalled();

    const second = await notifyCustomerOfInvoiceIssued(
      harness.supabase as never,
      INVOICE,
      WS
    );
    expect(second.ok && second.skipped).toBe("already_terminal");
    expect(harness.outbound).toHaveLength(1);
    expect(harness.outbound[0].id).toBe(enqueued.id);
    expect(harness.outbound[0].status).toBe("simulated");
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(pdfMock).not.toHaveBeenCalled();
    expect(harness.invoiceUpdates).toBe(0);
    expect(harness.proposalUpdates).toBe(0);
    expect(Boolean(process.env.RESEND_API_KEY?.trim())).toBe(false);
    expect(
      canShowInvoiceEmailButton({
        status: "approved",
        customerEmail: "morgan@example.test",
        outboundStatus: "simulated",
      })
    ).toBe(false);
    expect(
      describeInvoiceEmailFeedback({ status: "simulated", simulated: true })
        ?.title
    ).toBe("Simulated (no email sent)");
  });

  it("states a zero balance for a fully paid invoice without saying payment was received", async () => {
    const { buildInvoiceIssuedEmailPayload } = await import(
      "@/lib/invoices/server/notify-invoice-issued"
    );
    const harness = createHarness(
      invoiceRow({
        amount_paid: 240000,
        balance_due: 0,
      })
    );
    const invoice = parseInvoiceRow(harness.row);
    expect(invoice.balance_due).toBe(0);
    expect(invoice.amount_paid).toBe(invoice.total_amount);

    const built = await buildInvoiceIssuedEmailPayload(
      harness.supabase as never,
      invoice,
      WS
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const sent = built.payload;
    expect(sent.to).toBe("morgan@example.test");
    expect(sent.subject).toBe(
      "Invoice INV-2026-0009 from Frozen Snapshot Ltd"
    );
    expect(sent.subject).not.toContain("Live Business Should Not Be Used");
    expect(sent.attachments[0].filename).toBe("INV-2026-0009.pdf");
    expect(sent.message).toContain("Hi Morgan,");
    expect(sent.message).toContain(
      "Your invoice for Kitchen refresh is ready to review. A PDF copy is attached."
    );
    expect(sent.message).toContain("INV-2026-0009");
    expect(sent.message).toContain("Total\n£2,400.00");
    expect(sent.message).toContain("Balance\n£0.00");
    expect(sent.message).toContain(
      "Payments of £2,400.00 are recorded on this invoice. There is nothing left to pay."
    );
    expect(sent.message).not.toContain("Balance still to pay");
    expect(sent.message).not.toContain("We have received your payment");
    expect(sent.html).toContain(`/p/${TOKEN}`);
    expect(sent.html).toContain(`/p/${TOKEN}/invoice/pdf`);
    expect(sent.html).toContain("View invoice in portal");
    expect(sent.html).toContain("£0.00");
    expect(sent.html).not.toContain("We have received your payment");
    expect(harness.invoiceUpdates).toBe(0);
    expect(harness.proposalUpdates).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  function paymentEmail(amounts: {
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
  }) {
    return buildInvoiceIssuedEmail({
      businessName: "Frozen Snapshot Ltd",
      customerName: "Morgan Pricecheck",
      jobTitle: "Kitchen refresh",
      invoiceNumber: "INV-2026-1200",
      portalToken: TOKEN,
      ...amounts,
    }).text;
  }

  it("states the amount due on an unpaid invoice", () => {
    const text = paymentEmail({
      totalAmount: 120000,
      amountPaid: 0,
      balanceDue: 120000,
    });
    expect(text).toContain(
      "Amount due: £1,200.00. This email does not confirm that a payment has been received."
    );
    expect(text).toContain("Total\n£1,200.00");
    expect(text).toContain(`/p/${TOKEN}/invoice/pdf`);
    expect(text).not.toContain("Balance still to pay");
    expect(text).not.toContain("We have received your payment");
  });

  it("states recorded payments and the amount still due on a partly paid invoice", () => {
    const text = paymentEmail({
      totalAmount: 120000,
      amountPaid: 40000,
      balanceDue: 80000,
    });
    expect(text).toContain(
      "Payments of £400.00 are recorded on this invoice. Amount still to pay: £800.00. This email does not confirm that a payment has been received."
    );
    expect(text).toContain("Total\n£1,200.00");
    expect(text).not.toContain("Balance still to pay");
    expect(text).not.toContain("We have received your payment");
  });

  it("states that a fully paid invoice has nothing left to pay", () => {
    const text = paymentEmail({
      totalAmount: 120000,
      amountPaid: 120000,
      balanceDue: 0,
    });
    expect(text).toContain(
      "Payments of £1,200.00 are recorded on this invoice. There is nothing left to pay."
    );
    expect(text).not.toContain("Balance still to pay");
    expect(text).not.toContain("This email does not confirm that a payment has been received.");
    expect(text).not.toContain("We have received your payment");
  });

  it("states that a zero-value invoice has nothing left to pay", () => {
    const text = paymentEmail({
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0,
    });
    expect(text).toContain("There is nothing left to pay on this invoice.");
    expect(text).not.toContain("Payments of £0.00");
    expect(text).not.toContain("Balance still to pay");
    expect(text).not.toContain("We have received your payment");
  });

  it("does not choose a payment state when the saved figures do not agree", () => {
    const text = paymentEmail({
      totalAmount: 120000,
      amountPaid: 10000,
      balanceDue: 80000,
    });
    expect(text).toContain(
      "Outstanding balance shown on this invoice: £800.00. This email does not confirm that a payment has been received."
    );
    expect(text).not.toContain("There is nothing left to pay");
    expect(text).not.toContain("Amount due");
    expect(text).not.toContain("Amount still to pay");
    expect(text).not.toContain("We have received your payment");

    const inconsistentZero = paymentEmail({
      totalAmount: 120000,
      amountPaid: 0,
      balanceDue: 0,
    });
    expect(inconsistentZero).toContain(
      "Outstanding balance shown on this invoice: £0.00. This email does not confirm that a payment has been received."
    );
    expect(inconsistentZero).not.toContain("There is nothing left to pay");
    expect(inconsistentZero).not.toContain("Balance still to pay");
  });

  it("does not invent a balance when the saved balance is unusable", () => {
    const missing = paymentEmail({
      totalAmount: 120000,
      amountPaid: 0,
      balanceDue: Number.NaN,
    });
    expect(missing).toContain(
      "Please see the invoice for the current balance. This email does not confirm that a payment has been received."
    );
    expect(missing).not.toContain("£NaN");
    expect(missing).not.toContain("There is nothing left to pay");
    expect(missing).not.toContain("We have received your payment");
    expect(missing).not.toMatch(/\nBalance\n/);

    const negative = paymentEmail({
      totalAmount: 120000,
      amountPaid: 0,
      balanceDue: -1,
    });
    expect(negative).toContain(
      "Please see the invoice for the current balance. This email does not confirm that a payment has been received."
    );
    expect(negative).not.toContain("£-");
    expect(negative).not.toContain("There is nothing left to pay");
  });
});

describeRehearsalDb(
  "explicit invoice email disposable rehearsal",
  (getPsql) => {
    const psql = (sql: string) => getPsql()(sql);

  it("keeps one invoice_issued key and refuses a second claim while sending or unknown", () => {
    const db = psql("select current_database();");
    expect(db).toBe("reanvil_rehearsal");
    const workspaceId = psql("select id::text from public.workspaces limit 1;");
    expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/i);
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const key = `invoice_issued/${sourceId}`;
    const cleanup = `delete from public.outbound_messages where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';`;
    psql(cleanup);
    try {
      const enqueue = (label: string) =>
        psql(`
          select set_config('request.jwt.claim.role', 'service_role', true);
          select public.enqueue_outbound_message(
            '${workspaceId}'::uuid,
            'invoice_issued',
            'customer',
            'invoice',
            '${sourceId}'::uuid,
            'customer-local-test@example.test',
            '${key}',
            '${label}',
            null, null, null, null,
            '{"invoice_number":"INV-LOCAL"}'::jsonb
          )::text;
        `);
      const first = enqueue("first");
      const second = enqueue("second");
      expect(first).toMatch(/"created"\s*:\s*true/);
      expect(second).toMatch(/"created"\s*:\s*false/);
      const count = psql(
        `select count(*)::text from public.outbound_messages where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';`
      );
      expect(count).toBe("1");
      const messageId = psql(
        `select id::text from public.outbound_messages where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';`
      );
      const claim1 = psql(
        `select set_config('request.jwt.claim.role', 'service_role', true); select public.claim_outbound_message('${messageId}'::uuid)::text;`
      );
      const claim2 = psql(
        `select set_config('request.jwt.claim.role', 'service_role', true); select public.claim_outbound_message('${messageId}'::uuid)::text;`
      );
      expect(claim1).toMatch(/"status"\s*:\s*"sending"/);
      expect(claim2).toMatch(/"ok"\s*:\s*false/);
      const settled = psql(
        `select set_config('request.jwt.claim.role', 'service_role', true); select public.settle_outbound_message('${messageId}'::uuid, 'unknown', 'resend', null, 'timeout')::text;`
      );
      const claimUnknown = psql(
        `select set_config('request.jwt.claim.role', 'service_role', true); select public.claim_outbound_message('${messageId}'::uuid)::text;`
      );
      expect(settled).toMatch(/"status"\s*:\s*"unknown"/);
      expect(claimUnknown).toMatch(/"ok"\s*:\s*false/);
      const providerRows = psql(
        `select count(*)::text from public.outbound_messages where id = '${messageId}'::uuid and provider_message_id is not null;`
      );
      expect(providerRows).toBe("0");
    } finally {
      psql(cleanup);
    }
  });

  },
  { describe, beforeAll }
);
