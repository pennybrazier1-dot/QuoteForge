import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildOutboundIdempotencyKey,
  customerMessageKey,
  enquiryReceivedKey,
  invoiceIssuedKey,
  quoteAcceptedKey,
} from "@/lib/outbound/keys";
import {
  canConfirmOutboundWithoutResend,
  canRetryOutbound,
  legacyEmailOutcomeLabel,
  outboundStatusLabel,
} from "@/lib/outbound/status-labels";
import {
  maskEmailAddress,
  sanitizeOutboundError,
  toOutboundTraderView,
} from "@/lib/outbound/redact";
import {
  isMissingOutboundRecord,
  isRecoverableOutboundStatus,
} from "@/lib/outbound/handoff";
import {
  deliverOutboundMessage,
  enqueueAndDeliverOutboundMessage,
  simulateOutboundDelivery,
} from "@/lib/outbound/deliver";
import { outboundEmailBlockReason } from "@/lib/email/outbound-guard";
import type { OutboundMessageRow } from "@/lib/outbound/types";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Stage 9G.1 outbound foundation — keys and labels", () => {
  it("builds unique idempotency keys within Resend 256-char limit", () => {
    const a = enquiryReceivedKey("11111111-1111-1111-1111-111111111111");
    const b = quoteAcceptedKey("22222222-2222-2222-2222-222222222222");
    expect(a).toBe(
      "enquiry_received/11111111-1111-1111-1111-111111111111"
    );
    expect(b).not.toBe(a);
    expect(customerMessageKey("m1")).toContain("customer_message/");
    expect(invoiceIssuedKey("inv1").length).toBeLessThanOrEqual(256);
    expect(() => buildOutboundIdempotencyKey("enquiry_received", "")).toThrow();
  });

  it("labels provider acceptance separately from delivery", () => {
    expect(outboundStatusLabel("provider_accepted")).toMatch(/Provider accepted/i);
    expect(outboundStatusLabel("simulated")).toMatch(/Simulated/i);
    expect(outboundStatusLabel("failed")).toMatch(/failed/i);
    expect(canRetryOutbound("failed")).toBe(true);
    expect(canRetryOutbound("needed")).toBe(true);
    expect(canRetryOutbound("unknown")).toBe(false);
    expect(canConfirmOutboundWithoutResend("unknown")).toBe(true);
    expect(canConfirmOutboundWithoutResend("failed")).toBe(false);
    expect(legacyEmailOutcomeLabel({ provider: "resend" })).toMatch(
      /Provider accepted/i
    );
    expect(legacyEmailOutcomeLabel({ simulated: true })).toMatch(/Simulated/i);
    expect(legacyEmailOutcomeLabel({ status: "needed" })).toMatch(/not sent yet/i);
    expect(legacyEmailOutcomeLabel({ status: "failed" })).toMatch(/failed/i);
    expect(legacyEmailOutcomeLabel({ status: "unknown" })).toMatch(/Unsettled/i);
    expect(legacyEmailOutcomeLabel({ status: "sent" })).toMatch(
      /Provider accepted/i
    );
  });

  it("masks recipient emails and redacts secret-like errors", () => {
    expect(maskEmailAddress("casey@example.com")).toBe("c***@example.com");
    expect(sanitizeOutboundError("RESEND_API_KEY leaked")).toBe(
      "Redacted error detail"
    );
    expect(sanitizeOutboundError("Outbound email is blocked for local Supabase.")).toMatch(
      /blocked for local/i
    );
  });

  it("builds trader views without exposing full secrets", () => {
    const view = toOutboundTraderView({
      id: "out-1",
      event_kind: "enquiry_received",
      audience: "trader",
      status: "failed",
      recipient_email: "trader@example.com",
      subject: "New enquiry",
      attempt_at: "2026-11-03T12:00:00.000Z",
      attempt_count: 1,
      provider_message_id: null,
      last_error: "Outbound email is blocked for local Supabase.",
      proposal_id: null,
      enquiry_id: "enq-1",
      visit_id: null,
      invoice_id: null,
    });
    expect(view.recipientDisplay).toBe("t***@example.com");
    expect(view.canRetry).toBe(true);
    expect(view.statusLabel).toMatch(/failed/i);
  });

  it("detects missing and recoverable outbound records for handoff recovery", () => {
    expect(isMissingOutboundRecord(null)).toBe(true);
    expect(isMissingOutboundRecord({ id: "x" })).toBe(false);
    expect(isRecoverableOutboundStatus("needed")).toBe(true);
    expect(isRecoverableOutboundStatus("sending")).toBe(true);
    expect(isRecoverableOutboundStatus("provider_accepted")).toBe(false);
  });
});

describe("Stage 9G.1 outbound foundation — deliver state machine", () => {
  function mockRpcClient(handlers: Record<string, (args: unknown) => unknown>) {
    return {
      rpc: vi.fn(async (name: string, args: unknown) => {
        const handler = handlers[name];
        if (!handler) {
          return { data: null, error: { message: `missing rpc ${name}` } };
        }
        return { data: handler(args), error: null };
      }),
      from: vi.fn(),
    };
  }

  it("prevents a second concurrent claim from sending", async () => {
    let claimed = false;
    const supabase = mockRpcClient({
      claim_outbound_message: () => {
        if (claimed) {
          return {
            ok: false,
            reason: "Another send attempt is already in progress for this notification.",
            status: "sending",
          };
        }
        claimed = true;
        return {
          ok: true,
          id: "m1",
          status: "sending",
          attempt_count: 1,
          idempotency_key: "enquiry_received/e1",
          recipient_email: "trader@example.com",
          subject: "New enquiry",
          event_kind: "enquiry_received",
          audience: "trader",
          workspace_id: "w1",
        };
      },
      settle_outbound_message: () => ({ ok: true, id: "m1", status: "failed" }),
    });

    const sendEmail = vi.fn(async () => ({
      ok: false as const,
      error: "Outbound email is blocked for local Supabase.",
    }));

    const first = await deliverOutboundMessage(
      supabase as never,
      "m1",
      {
        subject: "New enquiry",
        message: "Hello",
        businessName: "Test Trade",
      },
      { sendEmail }
    );
    const second = await deliverOutboundMessage(
      supabase as never,
      "m1",
      {
        subject: "New enquiry",
        message: "Hello",
        businessName: "Test Trade",
      },
      { sendEmail }
    );

    expect(first.status).toBe("failed");
    expect(second.unknownOutcome || second.error).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("settles known provider failure as failed (retryable), not unknown", async () => {
    const settles: string[] = [];
    const supabase = mockRpcClient({
      claim_outbound_message: () => ({
        ok: true,
        id: "m2",
        status: "sending",
        idempotency_key: "customer_message/msg1",
        recipient_email: "trader@example.com",
      }),
      settle_outbound_message: (args: unknown) => {
        const a = args as { p_status: string };
        settles.push(a.p_status);
        return { ok: true, id: "m2", status: a.p_status };
      },
    });

    const result = await deliverOutboundMessage(
      supabase as never,
      "m2",
      {
        subject: "Message",
        message: "Hi",
        businessName: "Test",
      },
      {
        sendEmail: async () => ({
          ok: false,
          error: "Outbound email is blocked for local Supabase.",
        }),
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(settles).toEqual(["failed"]);
  });

  it("preserves unknown outcome when provider throws (no blind resend)", async () => {
    const settles: string[] = [];
    const supabase = mockRpcClient({
      claim_outbound_message: () => ({
        ok: true,
        id: "m3",
        status: "sending",
        idempotency_key: "quote_accepted/p1",
        recipient_email: "trader@example.com",
      }),
      settle_outbound_message: (args: unknown) => {
        const a = args as { p_status: string };
        settles.push(a.p_status);
        return { ok: true, id: "m3", status: a.p_status };
      },
    });

    const result = await deliverOutboundMessage(
      supabase as never,
      "m3",
      {
        subject: "Accepted",
        message: "Hi",
        businessName: "Test",
      },
      {
        sendEmail: async () => {
          throw new Error("network reset");
        },
      }
    );

    expect(result.unknownOutcome).toBe(true);
    expect(result.status).toBe("unknown");
    expect(settles).toEqual(["unknown"]);
  });

  it("records provider_accepted only when a message id is returned", async () => {
    const supabase = mockRpcClient({
      claim_outbound_message: () => ({
        ok: true,
        id: "m4",
        status: "sending",
        idempotency_key: "payment_requested/p1/v1",
        recipient_email: "customer@example.com",
      }),
      settle_outbound_message: (args: unknown) => {
        const a = args as {
          p_status: string;
          p_provider_message_id: string | null;
        };
        return {
          ok: true,
          id: "m4",
          status: a.p_status,
          provider_message_id: a.p_provider_message_id,
        };
      },
    });

    const result = await deliverOutboundMessage(
      supabase as never,
      "m4",
      {
        subject: "Payment",
        message: "Pay",
        businessName: "Test",
      },
      {
        sendEmail: async () => ({ ok: true, messageId: "re_test_123" }),
      }
    );

    expect(result.ok).toBe(true);
    expect(result.providerAccepted).toBe(true);
    expect(result.status).toBe("provider_accepted");
  });

  it("simulate path never implies inbox delivery", async () => {
    const supabase = mockRpcClient({
      claim_outbound_message: () => ({
        ok: true,
        id: "m5",
        status: "sending",
        idempotency_key: "invoice_issued/i1",
        recipient_email: "customer@example.com",
      }),
      settle_outbound_message: (args: unknown) => {
        const a = args as { p_status: string };
        expect(a.p_status).toBe("simulated");
        return { ok: true, id: "m5", status: "simulated" };
      },
    });

    const result = await simulateOutboundDelivery(supabase as never, "m5");
    expect(result.simulated).toBe(true);
    expect(result.status).toBe("simulated");
  });

  it("enqueueAndDeliver skips resend when already provider_accepted", async () => {
    const sendEmail = vi.fn();
    const supabase = mockRpcClient({
      enqueue_outbound_message: () => ({
        ok: true,
        created: false,
        id: "m6",
        status: "provider_accepted",
      }),
    });

    const result = await enqueueAndDeliverOutboundMessage(
      supabase as never,
      {
        workspaceId: "w1",
        eventKind: "enquiry_received",
        audience: "trader",
        sourceType: "enquiry",
        sourceId: "e1",
        recipientEmail: "t@example.com",
        idempotencyKey: enquiryReceivedKey("e1"),
      },
      {
        subject: "New enquiry",
        message: "Hi",
        businessName: "Test",
      },
      { sendEmail }
    );

    expect(result.ok).toBe(true);
    expect(result.providerAccepted).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("Stage 9G.1 outbound foundation — safety contracts", () => {
  it("keeps local outbound guard active for tests", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAllow = process.env.REANVIL_ALLOW_LOCAL_OUTBOUND;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
      delete process.env.REANVIL_ALLOW_LOCAL_OUTBOUND;
      expect(outboundEmailBlockReason()).toMatch(/blocked for local/i);
    } finally {
      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      }
      if (previousAllow === undefined) {
        delete process.env.REANVIL_ALLOW_LOCAL_OUTBOUND;
      } else {
        process.env.REANVIL_ALLOW_LOCAL_OUTBOUND = previousAllow;
      }
    }
  });

  it("migration and service use RPC mutations, not open client updates", () => {
    const migration = readRepo(
      "supabase/migrations/20261106010000_outbound_messages.sql"
    );
    expect(migration).toContain("create table if not exists public.outbound_messages");
    expect(migration).toContain("provider_accepted");
    expect(migration).toContain("revoke insert, update, delete");
    expect(migration).toContain("claim_outbound_message");
    expect(migration).toContain("reconcile_stale_outbound_sending");
    expect(migration).not.toContain("prevent_approved_invoice_rewrite");

    const deliver = readRepo("lib/outbound/deliver.ts");
    expect(deliver).toContain("idempotencyKey");
    expect(deliver).toContain("unknown");

    const notify = readRepo("lib/email/send-notification-email.ts");
    expect(notify).toContain("idempotencyKey");
    expect(notify).toContain("CreateEmailRequestOptions");

    // No business event wiring yet.
    expect(readRepo("lib/enquiries/server/public-actions.ts")).not.toContain(
      "enqueueOutboundMessage"
    );
    expect(readRepo("lib/proposals/customer-portal/actions.ts")).not.toContain(
      "enqueueOutboundMessage"
    );
    expect(readRepo("lib/payments/actions.ts")).not.toContain(
      "enqueueOutboundMessage"
    );
    expect(readRepo("lib/invoices/actions.ts")).not.toContain(
      "enqueueOutboundMessage"
    );
  });

  // Deferred (Thin B2): recovery-UI blind-resend contract lived here and read
  // components/outbound/outbound-recovery.tsx. Restore and validate that case
  // when outbound-recovery.tsx and lib/outbound/actions.ts ship together.
});

describe("formatOutboundAttemptAtUtc", () => {
  it("formats attempt timestamps deterministically in UTC", async () => {
    const { formatOutboundAttemptAtUtc } = await import(
      "@/lib/outbound/format-attempt-at"
    );
    expect(formatOutboundAttemptAtUtc("2026-11-04T20:14:00.000Z")).toBe(
      "4 Nov 2026, 20:14"
    );
    expect(formatOutboundAttemptAtUtc("not-a-date")).toBe("not-a-date");
  });
});

// Keep a type-level sanity check that row shape matches trader view mapping.
describe("Stage 9G.1 type smoke", () => {
  it("accepts a full outbound row shape", () => {
    const row: OutboundMessageRow = {
      id: "1",
      workspace_id: "w",
      event_kind: "enquiry_received",
      audience: "trader",
      source_type: "enquiry",
      source_id: "e",
      proposal_id: null,
      enquiry_id: "e",
      visit_id: null,
      invoice_id: null,
      recipient_email: "a@b.c",
      subject: null,
      status: "needed",
      provider: null,
      provider_message_id: null,
      attempt_at: null,
      attempt_count: 0,
      last_error: null,
      idempotency_key: "enquiry_received/e",
      metadata: {},
      created_at: "2026-11-03T00:00:00.000Z",
      updated_at: "2026-11-03T00:00:00.000Z",
    };
    expect(row.status).toBe("needed");
  });
});
