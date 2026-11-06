import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canShowInvoiceEmailButton,
  describeInvoiceEmailFeedback,
} from "@/lib/invoices/email-issued";
import { loadInvoiceEmailStatus } from "@/lib/invoices/server/load-invoice-email-status";
import { invoiceIssuedKey } from "@/lib/outbound/keys";
import { OUTBOUND_PROVIDER_ACCEPTED_NOTE } from "@/lib/outbound/types";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INVOICE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function readRepo(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function clientWith(rows: Record<string, unknown>[]) {
  return {
    from(table: string) {
      const filters: { col: string; val: unknown }[] = [];
      const api = {
        select() {
          return api;
        },
        eq(col: string, val: unknown) {
          filters.push({ col, val });
          return api;
        },
        maybeSingle: async () => {
          if (table !== "outbound_messages") return { data: null, error: null };
          const match = rows.find((row) =>
            filters.every((filter) => row[filter.col] === filter.val)
          );
          return { data: match ?? null, error: null };
        },
      };
      return api;
    },
  };
}

function outboundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "outbound-1",
    workspace_id: WS,
    event_kind: "invoice_issued",
    invoice_id: INVOICE,
    status: "provider_accepted",
    attempt_at: "2026-11-06T09:00:00.000Z",
    idempotency_key: invoiceIssuedKey(INVOICE),
    recipient_email: "customer@example.test",
    provider_message_id: "re_secret_provider_id",
    metadata: { portal: "token-must-not-leak" },
    ...overrides,
  };
}

describe("persisted invoice email status", () => {
  it("returns only status and attempt time for this workspace and invoice", async () => {
    const view = await loadInvoiceEmailStatus(
      clientWith([outboundRow()]) as never,
      WS,
      INVOICE
    );
    expect(view).toEqual({
      status: "provider_accepted",
      attemptAt: "2026-11-06T09:00:00.000Z",
    });
    expect(Object.keys(view ?? {}).sort()).toEqual(["attemptAt", "status"]);
    expect(JSON.stringify(view)).not.toContain("customer@example.test");
    expect(JSON.stringify(view)).not.toContain("re_secret_provider_id");
    expect(JSON.stringify(view)).not.toContain("token-must-not-leak");
  });

  it("hides another workspace, another invoice, and a different event", async () => {
    const row = outboundRow();
    expect(
      await loadInvoiceEmailStatus(clientWith([row]) as never, OTHER, INVOICE)
    ).toBeNull();
    expect(
      await loadInvoiceEmailStatus(
        clientWith([outboundRow({ invoice_id: OTHER })]) as never,
        WS,
        INVOICE
      )
    ).toBeNull();
    expect(
      await loadInvoiceEmailStatus(
        clientWith([outboundRow({ event_kind: "payment_requested" })]) as never,
        WS,
        INVOICE
      )
    ).toBeNull();
    expect(
      await loadInvoiceEmailStatus(clientWith([]) as never, WS, INVOICE)
    ).toBeNull();
  });

  it("shows the saved status before a new click, including after reload", () => {
    const cases = [
      {
        status: "needed",
        title: "Email not sent yet",
        button: true,
      },
      {
        status: "provider_accepted",
        title: "Provider accepted",
        button: false,
      },
      {
        status: "simulated",
        title: "Simulated (no email sent)",
        button: false,
      },
      {
        status: "sending",
        title: "Sending in progress",
        button: false,
      },
      {
        status: "unknown",
        title: "Delivery outcome unknown — do not resend",
        button: false,
      },
      {
        status: "failed",
        title: "Email failed",
        button: true,
      },
    ] as const;

    for (const item of cases) {
      const feedback = describeInvoiceEmailFeedback({ status: item.status });
      expect(feedback?.title).toBe(item.title);
      expect(feedback?.detail).not.toMatch(/customer opened|inbox received/i);
      expect(
        canShowInvoiceEmailButton({
          status: "approved",
          customerEmail: "morgan@example.test",
          outboundStatus: item.status,
        })
      ).toBe(item.button);
    }

    expect(
      canShowInvoiceEmailButton({
        status: "approved",
        customerEmail: "morgan@example.test",
        outboundStatus: null,
      })
    ).toBe(true);
    const accepted = describeInvoiceEmailFeedback({
      status: "provider_accepted",
    });
    expect(accepted?.detail).toBe(OUTBOUND_PROVIDER_ACCEPTED_NOTE);
    const failed = describeInvoiceEmailFeedback({ status: "failed" });
    expect(failed?.detail).toMatch(/retry/i);
  });

  it("loads that status on the invoice page and refreshes it after a send result", () => {
    const page = readRepo("app/(workspace)/proposals/[id]/invoice/page.tsx");
    const screen = readRepo("components/invoices/invoice-review-screen.tsx");
    const loader = readRepo("lib/invoices/server/load-invoice-email-status.ts");
    expect(page).toContain("loadInvoiceEmailStatus");
    expect(page).toContain("profile.workspace_id");
    expect(page).toContain("emailStatus={emailStatus}");
    expect(page).toContain('emailStatus?.status ?? "none"');
    expect(page).not.toContain("createServiceRoleClient");
    expect(page).not.toContain("customer_access_token");
    expect(loader).toContain("invoiceIssuedKey(invoiceId)");
    expect(loader).not.toContain("console.log");
    expect(loader).not.toContain("email_sent");
    expect(screen).toContain("emailState.emailDelivery");
    expect(screen).toContain("outboundStatus: emailStatus?.status");
    const policy = readRepo("supabase/migrations/20261106010000_outbound_messages.sql");
    expect(policy).toContain("workspace_id = public.current_workspace_id()");
  });
});

function psql(sql: string): string {
  return execFileSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      sql,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: "postgres" },
      timeout: 15000,
    }
  ).trim();
}

function localDbAvailable(): boolean {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (url && !/127\.0\.0\.1|localhost/.test(url)) return false;
    const host = psql("select inet_server_addr()::text;");
    return Boolean(host) && !host.includes("supabase.co");
  } catch {
    return false;
  }
}

const describeLocal = localDbAvailable() ? describe : describe.skip;

describeLocal("persisted invoice email status local database", () => {
  it("reads one workspace's invoice_issued status and not another workspace", () => {
    expect(psql("select current_database();")).toBe("postgres");
    const workspaceId = psql("select id::text from public.workspaces limit 1;");
    const otherId = psql(
      `select id::text from public.workspaces where id <> '${workspaceId}'::uuid limit 1;`
    );
    expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/i);
    const sourceId = "22222222-2222-4222-8222-222222222222";
    const key = invoiceIssuedKey(sourceId);
    const cleanup = `delete from public.outbound_messages where idempotency_key = '${key}';`;
    psql(cleanup);
    try {
      const created = psql(`
        select set_config('request.jwt.claim.role', 'service_role', true);
        select public.enqueue_outbound_message(
          '${workspaceId}'::uuid,
          'invoice_issued',
          'customer',
          'invoice',
          '${sourceId}'::uuid,
          'customer-status-test@example.test',
          '${key}',
          'status read',
          null, null, null, null,
          '{}'::jsonb
        )::text;
      `);
      expect(created).toMatch(/"created"\s*:\s*true/);
      const status = psql(
        `select status from public.outbound_messages where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';`
      );
      expect(status).toBe("needed");
      if (otherId) {
        const leaked = psql(
          `select count(*)::text from public.outbound_messages where workspace_id = '${otherId}'::uuid and idempotency_key = '${key}';`
        );
        expect(leaked).toBe("0");
      }
      const visibleColumns = psql(
        `select status || '|' || coalesce(attempt_at::text, '') from public.outbound_messages where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';`
      );
      expect(visibleColumns.startsWith("needed|")).toBe(true);
    } finally {
      psql(cleanup);
    }
  });
});
