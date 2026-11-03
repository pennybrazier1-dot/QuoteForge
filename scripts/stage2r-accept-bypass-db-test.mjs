#!/usr/bin/env node
/**
 * Stage 2R — local DB test: RPC acceptance works; direct/spoofed booked UPDATE fails.
 * Uses isolated DB stage2r_bypass. No production. No email/payments.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { assertLocalSafetyOrExit } from "./stage2c-safety.mjs";

assertLocalSafetyOrExit();

const DB = "stage2r_bypass";
const PG = {
  encoding: "utf8",
  env: { ...process.env, PGPASSWORD: "postgres" },
};

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 400) });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ""}`
  );
}

function adminSql(sql) {
  return spawnSync(
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
      "-c",
      sql,
    ],
    PG
  );
}

function psql(sql) {
  const res = spawnSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "postgres",
      "-d",
      DB,
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      sql,
    ],
    PG
  );
  return {
    ok: res.status === 0,
    out: ((res.stdout || "") + (res.stderr || "")).trim(),
    status: res.status,
  };
}

function psqlFile(path) {
  const res = spawnSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "postgres",
      "-d",
      DB,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      path,
    ],
    PG
  );
  return {
    ok: res.status === 0,
    out: ((res.stdout || "") + (res.stderr || "")).trim(),
    status: res.status,
  };
}

function recreateDb() {
  adminSql(`
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = 'stage2r_bypass' AND pid <> pg_backend_pid();
`);
  const recreate = spawnSync(
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
      "-c",
      "DROP DATABASE IF EXISTS stage2r_bypass;",
      "-c",
      "CREATE DATABASE stage2r_bypass OWNER postgres;",
    ],
    PG
  );
  if (recreate.status !== 0) {
    throw new Error(
      "Could not create stage2r_bypass: " + (recreate.stderr || recreate.stdout)
    );
  }
}

const BOOTSTRAP = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT anon TO postgres;
GRANT authenticated TO postgres;
GRANT service_role TO postgres;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
$$;

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id)
);
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  status text NOT NULL DEFAULT 'draft',
  title text,
  customer_name text,
  customer_email text,
  total_amount integer,
  subtotal_amount integer,
  vat_amount integer DEFAULT 0,
  content_revision integer NOT NULL DEFAULT 0,
  issued_content_revision integer,
  accepted_content_revision integer,
  accepted_total_amount integer,
  unsent_revision_at timestamptz,
  accepted_at timestamptz,
  booked_at timestamptz,
  completed_at timestamptz,
  booking_confirmation text,
  booking_confirm_status text,
  attention_reason text,
  planned_start_date date,
  planned_start_time text,
  planned_start_date_text text,
  estimated_duration text,
  issue_attempt_at timestamptz,
  issue_attempt_provider text,
  issue_attempt_message_id text,
  issue_attempt_content_revision integer,
  issue_send_claim_at timestamptz,
  issue_send_claim_revision integer,
  issue_send_claim_key text,
  issue_send_claim_by uuid,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.proposal_status_events (
  id bigserial PRIMARY KEY,
  workspace_id uuid,
  proposal_id uuid,
  event_type text,
  from_status text,
  to_status text,
  note text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  customer_id uuid,
  status text NOT NULL DEFAULT 'preparing',
  accepted_at timestamptz,
  UNIQUE (proposal_id)
);
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER set_proposals_updated_at BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Minimal stubs required by accept RPC body (schedule conflict helper).
CREATE OR REPLACE FUNCTION public.find_overlapping_schedule_conflict(
  p_workspace_id uuid,
  p_proposal_id uuid,
  p_start_date date,
  p_start_time text,
  p_duration text
) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
`;

function seedIds() {
  const out = psql(`
INSERT INTO public.workspaces (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS-A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS-B')
RETURNING id;
INSERT INTO public.profiles (id, workspace_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
SELECT 'ok';
`);
  if (!out.ok) throw new Error("seed failed: " + out.out);
}

function insertProposal(opts) {
  const {
    id,
    status = "waiting_for_customer",
    revision = 0,
    issued = null,
    total = 10000,
    unsent = "null",
  } = opts;
  const issuedSql =
    issued === null || issued === undefined ? "NULL" : String(issued);
  return psql(`
INSERT INTO public.proposals (
  id, workspace_id, status, title, customer_email, total_amount, subtotal_amount,
  content_revision, issued_content_revision, unsent_revision_at, estimated_duration
) VALUES (
  '${id}',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '${status}',
  'Stage 2R fictional',
  'customer.stage2r@example-customer.test',
  ${total},
  ${total},
  ${revision},
  ${issuedSql},
  ${unsent},
  '1 day'
);
`);
}

function asServiceRole(sql) {
  return psql(`
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', '', true);
${sql}
`);
}

function asOwner(sql) {
  return psql(`
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SET LOCAL ROLE authenticated;
${sql}
`);
}

async function main() {
  recreateDb();
  let r = psql(BOOTSTRAP);
  if (!r.ok) throw new Error("bootstrap failed: " + r.out);

  // Apply Stage 2 migrations that define prerequisites + this fix, in order.
  // Minimal path: only files that exist from 010000 through 080000; skip ones that
  // need tables we did not bootstrap by applying ONLY the accept-related chain
  // stubs already present, then 030000…080000 carefully.
  //
  // For this isolated harness we apply 080000 after installing a pre-2R accept
  // function matching Stage 2L finals (copied via migration 060000 excerpt is
  // heavy). Instead: apply migrations 030000→080000 that are self-contained
  // replacements of accept, after creating columns they need (already in bootstrap).

  const migDir = resolve(process.cwd(), "supabase/migrations");
  const needed = [
    "20261103030000_proposal_revision_acceptance.sql",
    "20261103040000_stage2j_accept_issue_safety.sql",
    "20261103050000_stage2k_safety_corrections.sql",
    "20261103051000_stage2k_slot_advisory_lock.sql",
    "20261103060000_stage2l_schedule_notify_issue.sql",
    "20261103080000_stage2r_accept_trusted_transition.sql",
    "20261103081000_stage2r_close_accept_bypasses.sql",
  ];

  // 030000 may need proposal_revisions etc. Prefer applying 080000 onto a
  // hand-installed Stage 2L-shaped accept from 060000 by running only 060000's
  // accept is hard. Simplest: apply full official chain from template dump of
  // local DB is too heavy. Use: install accept from 060000 file (creates many
  // objects) — if it fails, install a minimal pre-2R accept then 080000.

  // Minimal pre-2R accept (Stage 2L semantics without trust) so 080000 REPLACE works.
  const pre2r = `
CREATE OR REPLACE FUNCTION public.accept_proposal_at_revision(
  p_proposal_id uuid,
  p_expected_content_revision integer,
  p_accepted_at timestamptz,
  p_booking_confirmation text,
  p_source text,
  p_require_workspace_owner boolean default false,
  p_planned_start_date date default null,
  p_planned_start_time text default null,
  p_planned_start_date_text text default null,
  p_require_slot boolean default false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_jwt_role text := coalesce(auth.jwt()->>'role', current_setting('request.jwt.claim.role', true), '');
  v_workspace_id uuid;
  v_proposal public.proposals%rowtype;
  v_accepted_at timestamptz := coalesce(p_accepted_at, now());
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT workspace_id INTO v_workspace_id FROM public.profiles WHERE id = v_user_id;
    IF v_workspace_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Could not find your workspace.');
    END IF;
  ELSIF v_jwt_role = 'service_role' THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised.');
  END IF;

  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposal not found.');
  END IF;
  IF v_user_id IS NOT NULL AND v_proposal.workspace_id IS DISTINCT FROM v_workspace_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised for this proposal.');
  END IF;
  IF v_proposal.status = 'booked'
     AND v_proposal.accepted_content_revision IS NOT DISTINCT FROM p_expected_content_revision THEN
    RETURN jsonb_build_object('ok', true, 'already_accepted', true,
      'content_revision', v_proposal.content_revision,
      'accepted_content_revision', v_proposal.accepted_content_revision,
      'accepted_total_amount', v_proposal.accepted_total_amount,
      'total_amount', v_proposal.total_amount,
      'accepted_at', v_proposal.accepted_at,
      'workspace_id', v_proposal.workspace_id);
  END IF;
  IF v_proposal.status = 'booked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already accepted.');
  END IF;
  IF v_proposal.status NOT IN ('waiting_for_customer', 'needs_attention') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not acceptible.');
  END IF;
  IF v_proposal.unsent_revision_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unsent revision.');
  END IF;
  IF v_proposal.content_revision IS DISTINCT FROM p_expected_content_revision THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stale revision.', 'stale_revision', true);
  END IF;
  IF v_proposal.content_revision > 0
     AND v_proposal.issued_content_revision IS DISTINCT FROM v_proposal.content_revision THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not issued.');
  END IF;
  IF v_proposal.total_amount IS NULL OR v_proposal.total_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bad total.');
  END IF;

  UPDATE public.proposals SET
    status = 'booked',
    accepted_at = coalesce(accepted_at, v_accepted_at),
    booked_at = coalesce(booked_at, v_accepted_at),
    accepted_content_revision = v_proposal.content_revision,
    accepted_total_amount = v_proposal.total_amount,
    booking_confirmation = coalesce(nullif(trim(coalesce(p_booking_confirmation,'')),''), booking_confirmation)
  WHERE id = v_proposal.id
    AND status IN ('waiting_for_customer', 'needs_attention')
    AND unsent_revision_at IS NULL
    AND content_revision = p_expected_content_revision
    AND (content_revision = 0 OR issued_content_revision = content_revision);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stale revision.', 'stale_revision', true);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'already_accepted', false,
    'content_revision', v_proposal.content_revision,
    'accepted_content_revision', v_proposal.content_revision,
    'accepted_total_amount', v_proposal.total_amount,
    'total_amount', v_proposal.total_amount,
    'accepted_at', v_accepted_at,
    'workspace_id', v_proposal.workspace_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', coalesce(sqlerrm, 'fail'));
END;
$$;
REVOKE ALL ON FUNCTION public.accept_proposal_at_revision(
  uuid, integer, timestamptz, text, text, boolean, date, text, text, boolean
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_proposal_at_revision(
  uuid, integer, timestamptz, text, text, boolean, date, text, text, boolean
) TO authenticated, service_role;
`;
  r = psql(pre2r);
  if (!r.ok) throw new Error("pre2r accept install failed: " + r.out);

  // Prove pre-2R vulnerability: direct UPDATE succeeds before 080000.
  seedIds();
  const idVuln = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  insertProposal({ id: idVuln, revision: 1, issued: 1, total: 20000 });
  r = asServiceRole(`
UPDATE public.proposals
SET status = 'booked',
    accepted_at = now(),
    accepted_content_revision = 1,
    accepted_total_amount = 999
WHERE id = '${idVuln}'
RETURNING status, accepted_total_amount;
`);
  rec(
    "pre2r_direct_update_still_possible",
    r.ok && r.out.includes("booked"),
    r.out
  );

  // Apply 080000 then additive 081000 bypass closures
  const mig080 = resolve(migDir, "20261103080000_stage2r_accept_trusted_transition.sql");
  r = psqlFile(mig080);
  rec("apply_080000_migration", r.ok, r.ok ? "applied" : r.out);
  if (!r.ok) {
    console.error("Cannot continue without migration");
    process.exit(1);
  }
  const mig081 = resolve(migDir, "20261103081000_stage2r_close_accept_bypasses.sql");
  r = psqlFile(mig081);
  rec("apply_081000_migration", r.ok, r.ok ? "applied" : r.out);
  if (!r.ok) {
    console.error("Cannot continue without 081000");
    process.exit(1);
  }

  // Trust table privileges revoked from service_role
  r = psql(`
SELECT has_table_privilege('service_role', 'public.proposal_accept_transition_trust', 'INSERT')::text
 || ',' ||
 has_table_privilege('authenticated', 'public.proposal_accept_transition_trust', 'INSERT')::text;
`);
  rec(
    "trust_table_insert_denied_to_clients",
    r.ok && r.out === "false,false",
    r.out
  );

  // 1) Legitimate RPC accept (rev 0) as service_role
  const idOk = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  insertProposal({ id: idOk, revision: 0, issued: null, total: 15000 });
  r = asServiceRole(`
SELECT public.accept_proposal_at_revision(
  '${idOk}'::uuid, 0, now(), 'confirmed', 'customer_portal', false,
  NULL, NULL, NULL, false
)::text;
`);
  const rpcOk =
    r.ok &&
    r.out.includes('"ok": true') &&
    !r.out.includes('"already_accepted": true');
  rec("rpc_accept_revision_0_succeeds", rpcOk, r.out);
  r = psql(`SELECT status || ':' || accepted_content_revision || ':' || accepted_total_amount
            FROM public.proposals WHERE id = '${idOk}';`);
  rec("rpc_accept_persisted_snapshot", r.ok && r.out === "booked:0:15000", r.out);

  // 2) Stale revision fails via RPC
  const idStale = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  insertProposal({ id: idStale, revision: 2, issued: 2, total: 30000 });
  r = asServiceRole(`
SELECT public.accept_proposal_at_revision(
  '${idStale}'::uuid, 1, now(), 'confirmed', 'customer_portal', false,
  NULL, NULL, NULL, false
)::text;
`);
  rec(
    "rpc_stale_revision_fails",
    r.ok && (r.out.includes("stale_revision") || r.out.includes('"ok": false')),
    r.out
  );
  r = psql(`SELECT status FROM public.proposals WHERE id = '${idStale}';`);
  rec("rpc_stale_leaves_unbooked", r.ok && r.out === "waiting_for_customer", r.out);

  // 3) Direct old-style booked UPDATE fails (service_role, like portal admin client)
  const idDirect = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  insertProposal({ id: idDirect, revision: 1, issued: 1, total: 40000 });
  r = asServiceRole(`
UPDATE public.proposals
SET status = 'booked', accepted_at = now()
WHERE id = '${idDirect}'
RETURNING status;
`);
  rec(
    "direct_booked_update_blocked",
    !r.ok && r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );
  r = psql(`SELECT status FROM public.proposals WHERE id = '${idDirect}';`);
  rec("direct_update_row_unchanged", r.ok && r.out === "waiting_for_customer", r.out);

  // 4) Spoofed acceptance fields still blocked
  r = asServiceRole(`
UPDATE public.proposals
SET status = 'booked',
    accepted_at = now(),
    accepted_content_revision = 1,
    accepted_total_amount = 40000
WHERE id = '${idDirect}'
RETURNING status;
`);
  rec(
    "spoofed_accept_fields_blocked",
    !r.ok && r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );

  // 5) Stale trust row from another txid cannot unlock a later UPDATE
  r = psql(`
-- Simulate leaked trust from a finished transaction (different txid).
BEGIN;
INSERT INTO public.proposal_accept_transition_trust (proposal_id, txid)
VALUES ('${idDirect}', txid_current());
COMMIT;
UPDATE public.proposals
SET status = 'booked',
    accepted_content_revision = 1,
    accepted_total_amount = 40000
WHERE id = '${idDirect}'
RETURNING status;
`);
  rec(
    "stale_trust_row_other_txid_blocked",
    !r.ok && r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );

  // 6) Client cannot INSERT trust (service_role revoked)
  r = psql(`
SET ROLE service_role;
INSERT INTO public.proposal_accept_transition_trust (proposal_id, txid)
VALUES ('${idDirect}', txid_current());
`);
  rec("service_role_cannot_insert_trust", !r.ok, r.out);

  // 7) Legitimate RPC accept after failed direct attempts
  r = asServiceRole(`
SELECT public.accept_proposal_at_revision(
  '${idDirect}'::uuid, 1, now(), 'confirmed', 'customer_portal', false,
  NULL, NULL, NULL, false
)::text;
`);
  rec(
    "rpc_accept_after_blocked_direct",
    r.ok && r.out.includes('"ok": true'),
    r.out
  );

  // 8) Duplicate job prevented by unique(proposal_id)
  r = psql(`
INSERT INTO public.jobs (workspace_id, proposal_id, status, accepted_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '${idDirect}',
  'preparing',
  now()
);
INSERT INTO public.jobs (workspace_id, proposal_id, status, accepted_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '${idDirect}',
  'preparing',
  now()
);
`);
  rec("duplicate_job_unique_enforced", !r.ok && /unique|duplicate/i.test(r.out), r.out);

  // 9) Genuine reopen: RPC accept → completed → booked (receipt exists)
  const idReopen = "12121212-1212-1212-1212-121212121212";
  insertProposal({ id: idReopen, revision: 0, total: 5000 });
  r = asServiceRole(`
SELECT public.accept_proposal_at_revision(
  '${idReopen}'::uuid, 0, now(), 'confirmed', 'trader_acceptance', false,
  NULL, NULL, NULL, false
)::text;
`);
  rec("reopen_setup_rpc_accept", r.ok && r.out.includes('"ok": true'), r.out);
  r = psql(`
UPDATE public.proposals SET status = 'completed', completed_at = now()
WHERE id = '${idReopen}';
UPDATE public.proposals SET status = 'booked', completed_at = NULL
WHERE id = '${idReopen}'
RETURNING status;
`);
  rec("genuine_completed_to_booked_reopen", r.ok && r.out.includes("booked"), r.out);

  // 10) Non-status updates on awaiting proposal still work
  const idTouch = "34343434-3434-3434-3434-343434343434";
  insertProposal({ id: idTouch, revision: 0, total: 8000 });
  r = psql(`
UPDATE public.proposals
SET title = 'Stage 2R touch — fictional', planned_start_date = '2026-12-15'
WHERE id = '${idTouch}'
RETURNING title;
`);
  rec("non_accept_update_still_works", r.ok && r.out.includes("Stage 2R touch"), r.out);

  // 11) Owner RPC path
  const idOwner = "56565656-5656-5656-5656-565656565656";
  insertProposal({ id: idOwner, revision: 0, total: 9000 });
  r = asOwner(`
SELECT public.accept_proposal_at_revision(
  '${idOwner}'::uuid, 0, now(), NULL, 'trader_acceptance', true,
  NULL, NULL, NULL, false
)::text;
`);
  // SET LOCAL ROLE may prevent returning; check status instead if needed
  const ownerOk =
    (r.ok && r.out.includes('"ok": true')) ||
    psql(`SELECT status FROM public.proposals WHERE id = '${idOwner}';`).out ===
      "booked";
  rec("owner_rpc_accept_succeeds", ownerOk, r.out);

  // 12) Idempotent retry
  r = asServiceRole(`
SELECT public.accept_proposal_at_revision(
  '${idOk}'::uuid, 0, now(), 'confirmed', 'customer_portal', false,
  NULL, NULL, NULL, false
)::text;
`);
  rec(
    "rpc_already_accepted_retry",
    r.ok && r.out.includes('"already_accepted": true'),
    r.out
  );

  // 13) write_proposal_schedule_slot must not be a first-accept bypass.
  // Install a minimal SECURITY DEFINER writer matching production semantics.
  r = psql(`
CREATE OR REPLACE FUNCTION public.write_proposal_schedule_slot(
  p_proposal_id uuid,
  p_planned_start_date date,
  p_planned_start_time text,
  p_planned_start_date_text text,
  p_booking_confirmation text,
  p_next_status text default null,
  p_attention_reason text default null,
  p_estimated_duration text default null,
  p_require_available boolean default true,
  p_clear_pending_date_suggestion boolean default false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposal public.proposals%rowtype;
  v_next text;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposal not found.');
  END IF;
  v_next := coalesce(nullif(trim(coalesce(p_next_status, '')), ''), v_proposal.status);
  UPDATE public.proposals
  SET status = v_next,
      booking_confirmation = coalesce(nullif(trim(coalesce(p_booking_confirmation,'')),''), booking_confirmation),
      planned_start_date = p_planned_start_date,
      planned_start_time = nullif(trim(coalesce(p_planned_start_time,'')),''),
      planned_start_date_text = coalesce(nullif(trim(coalesce(p_planned_start_date_text,'')),''), planned_start_date_text)
  WHERE id = v_proposal.id;
  RETURN jsonb_build_object('ok', true, 'status', v_next);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', coalesce(sqlerrm, 'fail'));
END;
$$;
`);
  rec("install_write_slot_stub", r.ok, r.out);

  const idSlotBypass = "78787878-7878-7878-7878-787878787878";
  insertProposal({ id: idSlotBypass, revision: 1, issued: 1, total: 22000 });
  r = asServiceRole(`
SELECT public.write_proposal_schedule_slot(
  '${idSlotBypass}'::uuid, '2026-12-20'::date, '09:00', '20 Dec',
  'confirmed', 'booked', null, '1 day', true, false
)::text;
`);
  rec(
    "write_slot_first_accept_blocked",
    r.ok &&
      r.out.includes('"ok": false') &&
      r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );
  r = psql(`SELECT status FROM public.proposals WHERE id = '${idSlotBypass}';`);
  rec(
    "write_slot_row_still_unbooked",
    r.ok && r.out === "waiting_for_customer",
    r.out
  );

  // booked → booked schedule rewrite still allowed (post-acceptance diary).
  r = asServiceRole(`
SELECT public.write_proposal_schedule_slot(
  '${idOk}'::uuid, '2026-12-21'::date, '10:00', '21 Dec',
  'confirmed', 'booked', null, '1 day', true, false
)::text;
`);
  rec(
    "write_slot_already_booked_allowed",
    r.ok && r.out.includes('"ok": true'),
    r.out
  );

  // 14) Original revision-0 direct UPDATE also blocked (guard is all first accepts).
  const idRev0Direct = "90909090-9090-9090-9090-909090909090";
  insertProposal({ id: idRev0Direct, revision: 0, total: 11000 });
  r = asServiceRole(`
UPDATE public.proposals
SET status = 'booked', accepted_at = now(), accepted_content_revision = 0, accepted_total_amount = 11000
WHERE id = '${idRev0Direct}'
RETURNING status;
`);
  rec(
    "rev0_direct_booked_also_blocked",
    !r.ok && r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );

  // 15) waiting → completed → booked blocked (no trusted receipt)
  // Separate psql calls: one Query message rolls back all statements on error.
  const idForgeComplete = "a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0";
  insertProposal({ id: idForgeComplete, revision: 2, issued: 2, total: 77000 });
  r = psql(`
UPDATE public.proposals
SET status = 'completed', completed_at = now(), accepted_at = now(),
    accepted_content_revision = 2, accepted_total_amount = 77000
WHERE id = '${idForgeComplete}'
RETURNING status;
`);
  rec("forge_mark_completed_allowed", r.ok && r.out.includes("completed"), r.out);
  r = psql(`
UPDATE public.proposals
SET status = 'booked', completed_at = NULL
WHERE id = '${idForgeComplete}'
RETURNING status;
`);
  rec(
    "waiting_completed_booked_bypass_blocked",
    !r.ok && r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );
  r = psql(`SELECT status FROM public.proposals WHERE id = '${idForgeComplete}';`);
  rec(
    "forge_complete_path_left_unbooked",
    r.ok && r.out === "completed",
    r.out
  );

  // 16) Forged accepted_at alone cannot create a receipt / reopen
  r = psql(`
SET ROLE service_role;
INSERT INTO public.proposal_trusted_acceptances (
  proposal_id, content_revision, total_amount, accepted_at, source
) VALUES (
  '${idForgeComplete}', 2, 77000, now(), 'forged'
);
`);
  rec("service_role_cannot_insert_receipt", !r.ok, r.out);
  r = psql(`
UPDATE public.proposals
SET status = 'booked', completed_at = NULL, accepted_at = now()
WHERE id = '${idForgeComplete}'
RETURNING status;
`);
  rec(
    "forged_accepted_at_cannot_reopen",
    !r.ok && r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );

  // 17) Direct INSERT booked blocked
  r = psql(`
INSERT INTO public.proposals (
  id, workspace_id, status, title, total_amount, subtotal_amount, content_revision
) VALUES (
  'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'booked',
  'Stage 2R insert booked',
  1234,
  1234,
  0
);
`);
  rec(
    "direct_insert_booked_blocked",
    !r.ok && r.out.toLowerCase().includes("accept_proposal_at_revision"),
    r.out
  );

  // 18) Legitimate INSERT draft still works
  r = psql(`
INSERT INTO public.proposals (
  id, workspace_id, status, title, total_amount, subtotal_amount, content_revision
) VALUES (
  'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'draft',
  'Stage 2R draft insert',
  0,
  0,
  0
)
RETURNING status;
`);
  rec("legitimate_insert_draft_works", r.ok && r.out.includes("draft"), r.out);

  // 19) Cross-workspace owner cannot accept foreign proposal
  const idForeign = "d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3";
  r = psql(`
INSERT INTO public.proposals (
  id, workspace_id, status, title, total_amount, subtotal_amount, content_revision
) VALUES (
  '${idForeign}',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'waiting_for_customer',
  'Foreign WS',
  4400,
  4400,
  0
);
`);
  rec("seed_foreign_workspace_proposal", r.ok, r.out);
  r = asOwner(`
SELECT public.accept_proposal_at_revision(
  '${idForeign}'::uuid, 0, now(), NULL, 'trader_acceptance', true,
  NULL, NULL, NULL, false
)::text;
`);
  const foreignBlocked =
    (r.ok && r.out.includes('"ok": false') && /not authorised/i.test(r.out)) ||
    psql(`SELECT status FROM public.proposals WHERE id = '${idForeign}';`).out ===
      "waiting_for_customer";
  rec("cross_workspace_accept_blocked", foreignBlocked, r.out);
  r = psql(`SELECT status FROM public.proposals WHERE id = '${idForeign}';`);
  rec(
    "cross_workspace_row_unbooked",
    r.ok && r.out === "waiting_for_customer",
    r.out
  );

  // 20) Receipt exists after RPC accept
  r = psql(`
SELECT count(*)::text FROM public.proposal_trusted_acceptances
WHERE proposal_id = '${idOk}';
`);
  rec("trusted_receipt_recorded_after_rpc", r.ok && r.out === "1", r.out);

  void needed;
  void readdirSync;

  const failed = results.filter((x) => !x.ok);
  console.log("\n--- Stage 2R accept-bypass summary ---");
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("All Stage 2R bypass tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
