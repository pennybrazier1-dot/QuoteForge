/**
 * Local Postgres integration checks for Stage 9G.1.
 * Uses psql against 127.0.0.1:54322 only. Skips if local DB is unreachable.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

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

/** Run as service_role via JWT claim (PostgREST-compatible). Returns last result line. */
function psqlService(sql: string): string {
  const raw = psql(`
    select set_config('request.jwt.claim.role', 'service_role', true);
    ${sql}
  `);
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1] || raw;
}

function localDbAvailable(): boolean {
  try {
    const host = psql("select inet_server_addr()::text;");
    if (!host) return false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (url && !/127\.0\.0\.1|localhost/.test(url)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const describeLocal = localDbAvailable() ? describe : describe.skip;

describeLocal("Stage 9G.1 local SQL integration", () => {
  it("verifies local target before mutating", () => {
    const db = psql("select current_database();");
    expect(db).toBe("postgres");
    const table = psql(
      "select to_regclass('public.outbound_messages')::text;"
    );
    expect(table).toBe("outbound_messages");
  });

  it("enforces unique idempotency identity and concurrent claim exclusivity", () => {
    const workspaceId = psql("select id::text from public.workspaces limit 1;");
    expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/i);

    const sourceId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const key = `enquiry_received/${sourceId}-sql-test`;

    psql(
      `delete from public.outbound_messages where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';`
    );

    const first = psqlService(`
      select public.enqueue_outbound_message(
        '${workspaceId}'::uuid,
        'enquiry_received',
        'trader',
        'enquiry',
        '${sourceId}'::uuid,
        'trader-sql-test@example.com',
        '${key}',
        'SQL test enquiry',
        null, null, null, null,
        '{}'::jsonb
      )::text;
    `);
    expect(first).toMatch(/"created"\s*:\s*true/);

    const second = psqlService(`
      select public.enqueue_outbound_message(
        '${workspaceId}'::uuid,
        'enquiry_received',
        'trader',
        'enquiry',
        '${sourceId}'::uuid,
        'trader-sql-test@example.com',
        '${key}',
        'SQL test enquiry',
        null, null, null, null,
        '{}'::jsonb
      )::text;
    `);
    expect(second).toMatch(/"created"\s*:\s*false/);

    const messageId = psql(`
      select id::text from public.outbound_messages
      where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';
    `);
    expect(messageId).toMatch(/^[0-9a-f-]{36}$/i);

    const claim1 = psqlService(
      `select public.claim_outbound_message('${messageId}'::uuid)::text;`
    );
    expect(claim1).toMatch(/"ok"\s*:\s*true/);
    expect(claim1).toMatch(/"status"\s*:\s*"sending"/);

    const claim2 = psqlService(
      `select public.claim_outbound_message('${messageId}'::uuid)::text;`
    );
    expect(claim2).toMatch(/"ok"\s*:\s*false/);
    expect(claim2).toContain("sending");

    const settleFailed = psqlService(`
      select public.settle_outbound_message(
        '${messageId}'::uuid,
        'failed',
        'resend',
        null,
        'Outbound email is blocked for local Supabase.'
      )::text;
    `);
    expect(settleFailed).toMatch(/"status"\s*:\s*"failed"/);

    const claimRetry = psqlService(
      `select public.claim_outbound_message('${messageId}'::uuid)::text;`
    );
    expect(claimRetry).toMatch(/"ok"\s*:\s*true/);

    const settleUnknown = psqlService(`
      select public.settle_outbound_message(
        '${messageId}'::uuid,
        'unknown',
        'resend',
        null,
        'interrupted'
      )::text;
    `);
    expect(settleUnknown).toMatch(/"status"\s*:\s*"unknown"/);

    const claimUnknown = psqlService(
      `select public.claim_outbound_message('${messageId}'::uuid)::text;`
    );
    expect(claimUnknown).toMatch(/"ok"\s*:\s*false/);
    expect(claimUnknown).toMatch(/unsettled|unknown/i);

    const confirm = psqlService(`
      select public.confirm_outbound_message_without_resend(
        '${messageId}'::uuid,
        're_local_sql_test_message_id'
      )::text;
    `);
    expect(confirm).toMatch(/"status"\s*:\s*"provider_accepted"/);

    psql(
      `delete from public.outbound_messages where id = '${messageId}'::uuid;`
    );
  });

  it("reconciles stale sending to unknown without resending", () => {
    const workspaceId = psql("select id::text from public.workspaces limit 1;");
    const sourceId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const key = `quote_accepted/${sourceId}-stale-test`;

    psql(
      `delete from public.outbound_messages where workspace_id = '${workspaceId}'::uuid and idempotency_key = '${key}';`
    );

    const enq = psqlService(`
      select public.enqueue_outbound_message(
        '${workspaceId}'::uuid,
        'quote_accepted',
        'trader',
        'proposal',
        '${sourceId}'::uuid,
        'trader-stale@example.com',
        '${key}',
        'Stale claim test',
        null, null, null, null,
        '{}'::jsonb
      )->>'id';
    `);
    expect(enq).toMatch(/^[0-9a-f-]{36}$/i);

    psqlService(
      `select public.claim_outbound_message('${enq}'::uuid)::text;`
    );

    psql(`
      update public.outbound_messages
      set attempt_at = now() - interval '20 minutes'
      where id = '${enq}'::uuid;
    `);

    const reconciled = psqlService(
      `select public.reconcile_stale_outbound_sending(interval '15 minutes')::text;`
    );
    expect(reconciled).toMatch(/"ok"\s*:\s*true/);

    const status = psql(
      `select status from public.outbound_messages where id = '${enq}'::uuid;`
    );
    expect(status).toBe("unknown");

    psql(`delete from public.outbound_messages where id = '${enq}'::uuid;`);
  });

  it("restricts table privileges for anon and authenticated", () => {
    expect(
      psql(
        `select has_table_privilege('anon', 'public.outbound_messages', 'select')::text;`
      )
    ).toBe("false");
    expect(
      psql(
        `select has_table_privilege('authenticated', 'public.outbound_messages', 'select')::text;`
      )
    ).toBe("true");
    expect(
      psql(
        `select has_table_privilege('authenticated', 'public.outbound_messages', 'update')::text;`
      )
    ).toBe("false");
    expect(
      psql(
        `select has_table_privilege('authenticated', 'public.outbound_messages', 'insert')::text;`
      )
    ).toBe("false");
  });
});
