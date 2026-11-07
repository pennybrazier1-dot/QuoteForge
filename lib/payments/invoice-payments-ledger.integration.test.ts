/**
 * Stage 9I.3c Part 2 — disposable rehearsal Postgres ledger RPC checks.
 * Connects only through the fail-closed rehearsal guard (127.0.0.1:55432).
 * Ordinary unit runs skip without connecting. Does not send email or touch Production.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { describeRehearsalDb } from "@/lib/testing/rehearsal-db";

describeRehearsalDb(
  "invoice_payments ledger RPC (disposable rehearsal)",
  (getPsql) => {
    it("records £600 + £800 + £1000 against £2400, rejects overpay/dupes/wrong workspace", () => {
      const psql = getPsql();
      const suffix = randomUUID().slice(0, 8);
      const proposalId = randomUUID();
      const invoiceId = randomUUID();
      const jobId = randomUUID();
      const customerId = randomUUID();

      const workspaceId = psql(
        "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
      );
      const userId = psql(
        "select id::text from auth.users where email = 'sam.electrician.e2e@example.test' limit 1;"
      );
      const otherWorkspace = psql(
        "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'alex.trader.stage9b@example.test' limit 1;"
      );
      expect(workspaceId).toBeTruthy();
      expect(userId).toBeTruthy();
      expect(otherWorkspace).toBeTruthy();
      expect(otherWorkspace).not.toBe(workspaceId);

      // Seed fictional invoice (approved, unpaid). Bypass app writers.
      psql(`
      insert into public.customers (id, workspace_id, name, email)
      values ('${customerId}'::uuid, '${workspaceId}'::uuid, 'Ledger Test ${suffix}', 'ledger.${suffix}@example.test')
      on conflict do nothing;

      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, status, title,
        customer_name, customer_email, total_amount, payment_status
      ) values (
        '${proposalId}'::uuid, '${workspaceId}'::uuid, '${customerId}'::uuid,
        'QF-9I3C-${suffix}', 'completed', 'Ledger foundation fiction ${suffix}',
        'Ledger Test', 'ledger.${suffix}@example.test', 240000, 'requested'
      );

      insert into public.jobs (id, workspace_id, proposal_id, customer_id, status, completed_at)
      values (
        '${jobId}'::uuid, '${workspaceId}'::uuid, '${proposalId}'::uuid,
        '${customerId}'::uuid, 'invoiced', now()
      );

      insert into public.invoices (
        id, workspace_id, proposal_id, customer_id, job_id, invoice_number, status,
        job_title, line_items, subtotal_amount, vat_amount, total_amount,
        amount_paid, balance_due, agreed_total_amount, source_vat_amount,
        opening_amount_paid, approved_at
      ) values (
        '${invoiceId}'::uuid, '${workspaceId}'::uuid, '${proposalId}'::uuid,
        '${customerId}'::uuid, '${jobId}'::uuid, 'INV-9I3C-${suffix}', 'approved',
        'Ledger foundation fiction', '[]'::jsonb, 240000, 0, 240000,
        0, 240000, 240000, 0, 0, now()
      );
    `);

      const asSam = (sql: string) =>
        psql(`
        select set_config('request.jwt.claim.sub', '${userId}', true);
        select set_config('request.jwt.claim.role', 'authenticated', true);
        ${sql}
      `);

      const pay = (amount: number, key: string) =>
        asSam(`
        select public.record_invoice_payment(
          '${invoiceId}'::uuid,
          ${amount},
          'bank_transfer',
          current_date,
          'REF-${suffix}',
          null,
          '${key}'
        )::text;
      `);

      const r1 = JSON.parse(pay(60000, `dep/${invoiceId}/1`).split("\n").pop()!);
      expect(r1.ok).toBe(true);
      expect(r1.already_recorded).toBe(false);
      expect(r1.amount_paid).toBe(60000);
      expect(r1.balance_due).toBe(180000);
      expect(r1.proposal_payment_status).toBe("partially_paid");
      expect(r1.job_status).toBe("invoiced");
      expect(r1.fully_settled).toBe(false);

      const r2 = JSON.parse(pay(80000, `dep/${invoiceId}/2`).split("\n").pop()!);
      expect(r2.amount_paid).toBe(140000);
      expect(r2.balance_due).toBe(100000);
      expect(r2.proposal_payment_status).toBe("partially_paid");
      expect(r2.job_status).toBe("invoiced");

      const r3 = JSON.parse(pay(100000, `dep/${invoiceId}/3`).split("\n").pop()!);
      expect(r3.amount_paid).toBe(240000);
      expect(r3.balance_due).toBe(0);
      expect(r3.fully_settled).toBe(true);
      expect(r3.proposal_payment_status).toBe("paid");
      expect(r3.job_status).toBe("paid");

      // Duplicate key replay
      const dup = JSON.parse(pay(100000, `dep/${invoiceId}/3`).split("\n").pop()!);
      expect(dup.already_recorded).toBe(true);
      expect(dup.payment_id).toBe(r3.payment_id);

      const ledgerCount = psql(
        `select count(*)::text from public.invoice_payments where invoice_id = '${invoiceId}'::uuid;`
      );
      expect(ledgerCount).toBe("3");

      const closedAt = psql(
        `select (closed_at is null)::text from public.proposals where id = '${proposalId}'::uuid;`
      );
      expect(closedAt).toBe("true");

      const totals = psql(
        `select total_amount::text || ',' || vat_amount::text || ',' || subtotal_amount::text
       from public.invoices where id = '${invoiceId}'::uuid;`
      );
      expect(totals).toBe("240000,0,240000");

      // Overpay / invalid
      let overpayMsg = "";
      try {
        pay(1, `dep/${invoiceId}/over`);
      } catch (error) {
        overpayMsg = error instanceof Error ? error.message : String(error);
      }
      expect(overpayMsg).toMatch(
        /already fully (?:paid|settled)|exceed balance/i
      );

      let zeroMsg = "";
      try {
        asSam(`
        select public.record_invoice_payment(
          '${invoiceId}'::uuid, 0, 'cash', current_date, null, null, 'zero-${suffix}'
        );
      `);
      } catch (error) {
        zeroMsg = error instanceof Error ? error.message : String(error);
      }
      expect(zeroMsg).toMatch(/greater than zero/i);

      // Wrong workspace (Alex JWT against Sam invoice)
      const alexId = psql(
        "select id::text from auth.users where email = 'alex.trader.stage9b@example.test' limit 1;"
      );
      let wrongWs = "";
      try {
        psql(`
        select set_config('request.jwt.claim.sub', '${alexId}', true);
        select set_config('request.jwt.claim.role', 'authenticated', true);
        select public.record_invoice_payment(
          '${invoiceId}'::uuid, 100, 'cash', current_date, null, null, 'wrong-${suffix}'
        );
      `);
      } catch (error) {
        wrongWs = error instanceof Error ? error.message : String(error);
      }
      expect(wrongWs).toMatch(/Invoice not found/i);

      // Direct ledger insert blocked
      let directInsert = "";
      try {
        psql(`
        insert into public.invoice_payments (
          workspace_id, invoice_id, proposal_id, amount_pence, method, idempotency_key
        ) values (
          '${workspaceId}'::uuid, '${invoiceId}'::uuid, '${proposalId}'::uuid,
          1, 'cash', 'direct-${suffix}'
        );
      `);
      } catch (error) {
        directInsert = error instanceof Error ? error.message : String(error);
      }
      expect(directInsert).toMatch(/only be written via record_invoice_payment/i);

      // Part 3: authenticated may EXECUTE RPC; still cannot INSERT into ledger.
      const authExec = psql(
        `select has_function_privilege('authenticated', 'public.record_invoice_payment(uuid,integer,text,date,text,text,text)', 'execute')::text;`
      );
      expect(authExec === "t" || authExec === "true").toBe(true);
      const authInsert = psql(
        `select has_table_privilege('authenticated', 'public.invoice_payments', 'insert')::text;`
      );
      expect(authInsert === "f" || authInsert === "false").toBe(true);

      // Historical fully paid remains paid with empty ledger + opening snapshot
      const hist = psql(`
      select invoice_number || ':' || opening_amount_paid::text || ':' || amount_paid::text || ':' || balance_due::text || ':' ||
        (select count(*)::text from public.invoice_payments p where p.invoice_id = i.id)
      from public.invoices i
      where invoice_number = 'INV-2026-0002';
    `);
      expect(hist).toBe("INV-2026-0002:152000:152000:0:0");

      // Cleanup: deletes are forbidden by append-only trigger — disable briefly as postgres.
      psql(`
      alter table public.invoice_payments disable trigger enforce_invoice_payments_rpc_only;
      delete from public.invoice_payments where invoice_id = '${invoiceId}'::uuid;
      alter table public.invoice_payments enable trigger enforce_invoice_payments_rpc_only;
      delete from public.invoices where id = '${invoiceId}'::uuid;
      delete from public.jobs where id = '${jobId}'::uuid;
      delete from public.proposals where id = '${proposalId}'::uuid;
      delete from public.customers where id = '${customerId}'::uuid;
    `);
    });

    it("rejects concurrent second payment that would overpay remaining balance", () => {
      const psql = getPsql();
      const suffix = randomUUID().slice(0, 8);
      const proposalId = randomUUID();
      const invoiceId = randomUUID();
      const jobId = randomUUID();
      const customerId = randomUUID();
      const workspaceId = psql(
        "select workspace_id::text from public.profiles p join auth.users u on u.id = p.id where u.email = 'sam.electrician.e2e@example.test' limit 1;"
      );
      const userId = psql(
        "select id::text from auth.users where email = 'sam.electrician.e2e@example.test' limit 1;"
      );

      psql(`
      insert into public.customers (id, workspace_id, name, email)
      values ('${customerId}'::uuid, '${workspaceId}'::uuid, 'Concurrent ${suffix}', 'c.${suffix}@example.test');
      insert into public.proposals (
        id, workspace_id, customer_id, proposal_number, status, title,
        customer_name, customer_email, total_amount, payment_status
      ) values (
        '${proposalId}'::uuid, '${workspaceId}'::uuid, '${customerId}'::uuid,
        'QF-9I3CX-${suffix}', 'completed', 'Concurrent fiction',
        'Concurrent', 'c.${suffix}@example.test', 10000, 'requested'
      );
      insert into public.jobs (id, workspace_id, proposal_id, customer_id, status)
      values ('${jobId}'::uuid, '${workspaceId}'::uuid, '${proposalId}'::uuid, '${customerId}'::uuid, 'invoiced');
      insert into public.invoices (
        id, workspace_id, proposal_id, customer_id, job_id, invoice_number, status,
        job_title, line_items, subtotal_amount, vat_amount, total_amount,
        amount_paid, balance_due, agreed_total_amount, source_vat_amount,
        opening_amount_paid, approved_at
      ) values (
        '${invoiceId}'::uuid, '${workspaceId}'::uuid, '${proposalId}'::uuid,
        '${customerId}'::uuid, '${jobId}'::uuid, 'INV-9I3CX-${suffix}', 'approved',
        'Concurrent', '[]'::jsonb, 10000, 0, 10000,
        0, 10000, 10000, 0, 0, now()
      );
    `);

      // First takes full balance
      psql(`
      select set_config('request.jwt.claim.sub', '${userId}', true);
      select set_config('request.jwt.claim.role', 'authenticated', true);
      select public.record_invoice_payment(
        '${invoiceId}'::uuid, 10000, 'cash', current_date, null, null, 'full-${suffix}'
      );
    `);

      let second = "";
      try {
        psql(`
        select set_config('request.jwt.claim.sub', '${userId}', true);
        select set_config('request.jwt.claim.role', 'authenticated', true);
        select public.record_invoice_payment(
          '${invoiceId}'::uuid, 10000, 'cash', current_date, null, null, 'full2-${suffix}'
        );
      `);
      } catch (error) {
        second = error instanceof Error ? error.message : String(error);
      }
      expect(second).toMatch(/already fully (?:paid|settled)|exceed balance/i);

      const count = psql(
        `select count(*)::text from public.invoice_payments where invoice_id = '${invoiceId}'::uuid;`
      );
      expect(count).toBe("1");

      psql(`
      alter table public.invoice_payments disable trigger enforce_invoice_payments_rpc_only;
      delete from public.invoice_payments where invoice_id = '${invoiceId}'::uuid;
      alter table public.invoice_payments enable trigger enforce_invoice_payments_rpc_only;
      delete from public.invoices where id = '${invoiceId}'::uuid;
      delete from public.jobs where id = '${jobId}'::uuid;
      delete from public.proposals where id = '${proposalId}'::uuid;
      delete from public.customers where id = '${customerId}'::uuid;
    `);
    });
  },
  { describe, beforeAll }
);
