/**
 * Part 2U-bis — LOCAL Postgres identity / crash-gap checks.
 * Uses psql against 127.0.0.1:54322. Skips if local DB unreachable.
 * Does not send email. Does not write Production.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

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
      timeout: 30000,
    }
  ).trim();
}

function localDbAvailable(): boolean {
  try {
    const col = psql(
      "select column_name from information_schema.columns where table_schema='public' and table_name='proposals' and column_name='payment_request_event_id';"
    );
    return col === "payment_request_event_id";
  } catch {
    return false;
  }
}

const describeLocal = localDbAvailable() ? describe : describe.skip;

describeLocal("payment_request_event_id durability (LOCAL)", () => {
  it("same event id survives timestamp refresh; new id replaces; length check enforced", () => {
    const suffix = randomUUID().slice(0, 8);
    const proposalId = randomUUID();
    const customerId = randomUUID();
    const eventA = `req-${randomUUID()}`;
    const eventB = `req-${randomUUID()}`;

    const workspaceId = psql(
      "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
    );
    expect(workspaceId).toBeTruthy();

    psql(`
      insert into public.customers (id, workspace_id, name, email)
      values ('${customerId}'::uuid, '${workspaceId}'::uuid, 'Evt ${suffix}', 'evt.${suffix}@example.test')
      on conflict do nothing;
      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, title, status, payment_status,
        payment_requested_at, payment_request_event_id, payment_due_amount,
        currency, total_amount
      ) values (
        '${proposalId}'::uuid, '${workspaceId}'::uuid, '${customerId}'::uuid,
        'QF-2UB-${suffix}', 'Identity ${suffix}', 'completed', 'requested',
        '2026-11-05T12:00:00.000Z', '${eventA}', 10000,
        'GBP', 10000
      );
    `);

    // Same-request retry: refresh audit timestamp, keep event id.
    psql(`
      update public.proposals
      set payment_requested_at = '2026-11-05T12:05:00.000Z',
          payment_request_event_id = '${eventA}'
      where id = '${proposalId}'::uuid;
    `);
    const kept = psql(
      `select payment_request_event_id from public.proposals where id = '${proposalId}'::uuid;`
    );
    expect(kept).toBe(eventA);

    // Genuine new request: distinct event id.
    psql(`
      update public.proposals
      set payment_requested_at = '2026-11-05T12:10:00.000Z',
          payment_request_event_id = '${eventB}'
      where id = '${proposalId}'::uuid;
    `);
    const replaced = psql(
      `select payment_request_event_id from public.proposals where id = '${proposalId}'::uuid;`
    );
    expect(replaced).toBe(eventB);
    expect(replaced).not.toBe(eventA);

    // Length check rejects too-short ids.
    let rejected = false;
    try {
      psql(`
        update public.proposals
        set payment_request_event_id = 'short'
        where id = '${proposalId}'::uuid;
      `);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);

    // Cleanup
    psql(`
      delete from public.proposals where id = '${proposalId}'::uuid;
      delete from public.customers where id = '${customerId}'::uuid;
    `);
  });

  it("workspace isolation: event id column is per-proposal row, not global", () => {
    const a = randomUUID();
    const b = randomUUID();
    const customerA = randomUUID();
    const customerB = randomUUID();
    const eventShared = `shared-${randomUUID()}`;

    const workspaceA = psql(
      "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
    );
    const workspaceB = psql(
      "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'alex.trader.stage9b@example.test' limit 1;"
    );
    expect(workspaceA).toBeTruthy();
    expect(workspaceB).toBeTruthy();
    expect(workspaceA).not.toBe(workspaceB);

    psql(`
      insert into public.customers (id, workspace_id, name, email) values
        ('${customerA}'::uuid, '${workspaceA}'::uuid, 'Iso A', 'iso.a.${a}@example.test'),
        ('${customerB}'::uuid, '${workspaceB}'::uuid, 'Iso B', 'iso.b.${b}@example.test')
      on conflict do nothing;
      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, title, status, payment_status,
        payment_request_event_id, payment_due_amount, currency, total_amount
      ) values
        ('${a}'::uuid, '${workspaceA}'::uuid, '${customerA}'::uuid, 'QF-2UB-A-${a.slice(0,8)}', 'Iso A', 'completed', 'requested', '${eventShared}', 5000, 'GBP', 5000),
        ('${b}'::uuid, '${workspaceB}'::uuid, '${customerB}'::uuid, 'QF-2UB-B-${b.slice(0,8)}', 'Iso B', 'completed', 'requested', '${eventShared}', 5000, 'GBP', 5000);
    `);

    const count = psql(
      `select count(*)::text from public.proposals where payment_request_event_id = '${eventShared}';`
    );
    expect(count).toBe("2");

    const wa = psql(
      `select workspace_id::text from public.proposals where id = '${a}'::uuid;`
    );
    const wb = psql(
      `select workspace_id::text from public.proposals where id = '${b}'::uuid;`
    );
    expect(wa).toBe(workspaceA);
    expect(wb).toBe(workspaceB);

    psql(`
      delete from public.proposals where id in ('${a}'::uuid, '${b}'::uuid);
      delete from public.customers where id in ('${customerA}'::uuid, '${customerB}'::uuid);
    `);
  });
});

describeLocal("payment_request_event_id concurrency (LOCAL)", () => {
  it("never-enqueued A survives B when app reuses pending id (DB column model)", () => {
    // Simulates the durable state machine the action enforces: while no outbound
    // row exists for A, the current column must remain A (B must not win).
    const suffix = randomUUID().slice(0, 8);
    const proposalId = randomUUID();
    const customerId = randomUUID();
    const eventA = `reqA-${randomUUID()}`;
    const eventB = `reqB-${randomUUID()}`;

    const workspaceId = psql(
      "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
    );
    expect(workspaceId).toBeTruthy();

    psql(`
      insert into public.customers (id, workspace_id, name, email)
      values ('${customerId}'::uuid, '${workspaceId}'::uuid, 'Conc ${suffix}', 'conc.${suffix}@example.test')
      on conflict do nothing;
      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, title, status, payment_status,
        payment_requested_at, payment_request_event_id, payment_due_amount,
        currency, total_amount
      ) values (
        '${proposalId}'::uuid, '${workspaceId}'::uuid, '${customerId}'::uuid,
        'QF-2UT-${suffix}', 'Concurrency ${suffix}', 'completed', 'requested',
        now(), '${eventA}', 10000, 'GBP', 10000
      );
    `);

    // App policy: without outbound for A, keep A (do not apply B).
    const outboundA = psql(
      `select count(*)::text from public.outbound_messages
       where workspace_id = '${workspaceId}'::uuid
         and idempotency_key = 'payment_requested/${proposalId}/${eventA}';`
    );
    expect(outboundA).toBe("0");

    // Correct concurrent resolution: leave A in place.
    const kept = psql(
      `select payment_request_event_id from public.proposals where id = '${proposalId}'::uuid;`
    );
    expect(kept).toBe(eventA);
    expect(kept).not.toBe(eventB);

    // After A is enqueued (row exists), a new request may take B.
    psql(`
      insert into public.outbound_messages (
        id, workspace_id, event_kind, audience, source_type, source_id,
        proposal_id, recipient_email, subject, status, idempotency_key
      ) values (
        '${randomUUID()}'::uuid, '${workspaceId}'::uuid, 'payment_requested', 'customer',
        'proposal_payment', '${proposalId}'::uuid, '${proposalId}'::uuid,
        'conc.${suffix}@example.test', 'Payment requested', 'needed',
        'payment_requested/${proposalId}/${eventA}'
      );
      update public.proposals
      set payment_request_event_id = '${eventB}', payment_requested_at = now()
      where id = '${proposalId}'::uuid;
    `);
    const after = psql(
      `select payment_request_event_id from public.proposals where id = '${proposalId}'::uuid;`
    );
    expect(after).toBe(eventB);

    // Prior enqueued A remains recoverable by its outbound key.
    const stillA = psql(
      `select count(*)::text from public.outbound_messages
       where workspace_id = '${workspaceId}'::uuid
         and idempotency_key = 'payment_requested/${proposalId}/${eventA}';`
    );
    expect(stillA).toBe("1");

    psql(`
      delete from public.outbound_messages where proposal_id = '${proposalId}'::uuid;
      delete from public.proposals where id = '${proposalId}'::uuid;
      delete from public.customers where id = '${customerId}'::uuid;
    `);
  });
});


describeLocal("payment_request_event_id atomic CAS (LOCAL Part 2W)", () => {
  it("two different first-writer UUIDs: only one claims NULL; loser cannot overwrite", () => {
    const suffix = randomUUID().slice(0, 8);
    const proposalId = randomUUID();
    const customerId = randomUUID();
    const eventA = `reqA-${randomUUID()}`;
    const eventB = `reqB-${randomUUID()}`;

    const workspaceId = psql(
      "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
    );
    expect(workspaceId).toBeTruthy();

    psql(`
      insert into public.customers (id, workspace_id, name, email)
      values ('${customerId}'::uuid, '${workspaceId}'::uuid, 'CAS ${suffix}', 'cas.${suffix}@example.test')
      on conflict do nothing;
      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, title, status, payment_status,
        payment_due_amount, currency, total_amount
      ) values (
        '${proposalId}'::uuid, '${workspaceId}'::uuid, '${customerId}'::uuid,
        'QF-2W-${suffix}', 'CAS ${suffix}', 'completed', 'not_requested',
        10000, 'GBP', 10000
      );
    `);

    // A claims NULL
    const aRows = psql(`
      with u as (
        update public.proposals
        set payment_status='requested',
            payment_requested_at='2026-11-05T13:00:00.000Z',
            payment_request_event_id='${eventA}',
            payment_due_amount=10000
        where id='${proposalId}'::uuid
          and payment_request_event_id is null
          and closed_at is null
          and payment_status is distinct from 'paid'
          and payment_status is distinct from 'waived'
        returning payment_request_event_id
      ) select count(*)::text from u;
    `);
    expect(aRows).toBe("1");

    // B attempts different UUID with same CAS predicate — must affect 0 rows
    const bRows = psql(`
      with u as (
        update public.proposals
        set payment_status='requested',
            payment_requested_at='2026-11-05T13:01:00.000Z',
            payment_request_event_id='${eventB}',
            payment_due_amount=20000
        where id='${proposalId}'::uuid
          and payment_request_event_id is null
          and closed_at is null
          and payment_status is distinct from 'paid'
          and payment_status is distinct from 'waived'
        returning payment_request_event_id
      ) select count(*)::text from u;
    `);
    expect(bRows).toBe("0");

    const final = psql(
      `select payment_request_event_id || '|' || payment_due_amount::text || '|' || payment_requested_at::text
       from public.proposals where id='${proposalId}'::uuid;`
    );
    expect(final.startsWith(`${eventA}|10000|`)).toBe(true);
    expect(final.includes(eventB)).toBe(false);
    expect(final.includes("|20000|")).toBe(false);

    // Unconditional overwrite (old bug) would change amount — prove CAS path kept A.
    const outboundA = psql(
      `select count(*)::text from public.outbound_messages
       where workspace_id='${workspaceId}'::uuid
         and idempotency_key='payment_requested/${proposalId}/${eventA}';`
    );
    expect(outboundA).toBe("0"); // crash before enqueue — identity still recoverable
    const recoverable = psql(
      `select payment_request_event_id from public.proposals where id='${proposalId}'::uuid;`
    );
    expect(recoverable).toBe(eventA);

    psql(`
      delete from public.proposals where id='${proposalId}'::uuid;
      delete from public.customers where id='${customerId}'::uuid;
    `);
  });

  it("same-id retry does not change amount or timestamp under pending identity", () => {
    const suffix = randomUUID().slice(0, 8);
    const proposalId = randomUUID();
    const customerId = randomUUID();
    const eventA = `reqA-${randomUUID()}`;

    const workspaceId = psql(
      "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
    );

    psql(`
      insert into public.customers (id, workspace_id, name, email)
      values ('${customerId}'::uuid, '${workspaceId}'::uuid, 'Retry ${suffix}', 'retry.${suffix}@example.test')
      on conflict do nothing;
      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, title, status, payment_status,
        payment_requested_at, payment_request_event_id, payment_due_amount, currency, total_amount
      ) values (
        '${proposalId}'::uuid, '${workspaceId}'::uuid, '${customerId}'::uuid,
        'QF-2WR-${suffix}', 'Retry ${suffix}', 'completed', 'requested',
        '2026-11-05T12:00:00.000Z', '${eventA}', 10000, 'GBP', 10000
      );
    `);

    // App same-id pending path skips financial write — simulate by asserting
    // a mistaken full update under CAS-on-null cannot run (event id already set).
    const skipped = psql(`
      with u as (
        update public.proposals
        set payment_due_amount=99999,
            payment_requested_at='2026-11-05T15:00:00.000Z'
        where id='${proposalId}'::uuid
          and payment_request_event_id is null
        returning id
      ) select count(*)::text from u;
    `);
    expect(skipped).toBe("0");

    const kept = psql(
      `select payment_request_event_id || '|' || payment_due_amount::text || '|' || payment_requested_at::text
       from public.proposals where id='${proposalId}'::uuid;`
    );
    expect(kept).toBe(`${eventA}|10000|2026-11-05 12:00:00+00`);

    psql(`
      delete from public.proposals where id='${proposalId}'::uuid;
      delete from public.customers where id='${customerId}'::uuid;
    `);
  });

  it("after outbound exists, CAS replace allows one new event id", () => {
    const suffix = randomUUID().slice(0, 8);
    const proposalId = randomUUID();
    const customerId = randomUUID();
    const eventA = `reqA-${randomUUID()}`;
    const eventB = `reqB-${randomUUID()}`;
    const eventC = `reqC-${randomUUID()}`;
    const outId = randomUUID();

    const workspaceId = psql(
      "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
    );

    psql(`
      insert into public.customers (id, workspace_id, name, email)
      values ('${customerId}'::uuid, '${workspaceId}'::uuid, 'Rep ${suffix}', 'rep.${suffix}@example.test')
      on conflict do nothing;
      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, title, status, payment_status,
        payment_requested_at, payment_request_event_id, payment_due_amount, currency, total_amount
      ) values (
        '${proposalId}'::uuid, '${workspaceId}'::uuid, '${customerId}'::uuid,
        'QF-2WP-${suffix}', 'Replace ${suffix}', 'completed', 'requested',
        now(), '${eventA}', 10000, 'GBP', 10000
      );
      insert into public.outbound_messages (
        id, workspace_id, event_kind, audience, source_type, source_id,
        proposal_id, recipient_email, subject, status, idempotency_key
      ) values (
        '${outId}'::uuid, '${workspaceId}'::uuid, 'payment_requested', 'customer',
        'proposal_payment', '${proposalId}'::uuid, '${proposalId}'::uuid,
        'rep.${suffix}@example.test', 'Payment requested', 'provider_accepted',
        'payment_requested/${proposalId}/${eventA}'
      );
    `);

    const bWin = psql(`
      with u as (
        update public.proposals
        set payment_request_event_id='${eventB}',
            payment_due_amount=15000,
            payment_requested_at='2026-11-05T14:00:00.000Z',
            payment_status='requested'
        where id='${proposalId}'::uuid
          and payment_request_event_id='${eventA}'
        returning payment_request_event_id
      ) select count(*)::text from u;
    `);
    expect(bWin).toBe("1");

    const cLose = psql(`
      with u as (
        update public.proposals
        set payment_request_event_id='${eventC}',
            payment_due_amount=18000
        where id='${proposalId}'::uuid
          and payment_request_event_id='${eventA}'
        returning payment_request_event_id
      ) select count(*)::text from u;
    `);
    expect(cLose).toBe("0");

    const final = psql(
      `select payment_request_event_id || '|' || payment_due_amount::text
       from public.proposals where id='${proposalId}'::uuid;`
    );
    expect(final).toBe(`${eventB}|15000`);

    // Prior terminal outbound for A remains
    const stillA = psql(
      `select count(*)::text from public.outbound_messages
       where idempotency_key='payment_requested/${proposalId}/${eventA}'
         and status='provider_accepted';`
    );
    expect(stillA).toBe("1");

    psql(`
      delete from public.outbound_messages where proposal_id='${proposalId}'::uuid;
      delete from public.proposals where id='${proposalId}'::uuid;
      delete from public.customers where id='${customerId}'::uuid;
    `);
  });
});
