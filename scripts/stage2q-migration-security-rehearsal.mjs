#!/usr/bin/env node
/**
 * Stage 2Q — isolated migration-chain security rehearsal.
 * Does NOT touch the main local `postgres` database.
 * Fictional workspaces only. No Resend/Stripe/prod.
 *
 * After EACH migration that defines accept_proposal_at_revision:
 *   - verify function grants (anon denied)
 *   - attempt anonymous execution (must fail; record unchanged)
 *   - attempt authenticated cross-workspace accept with BOTH ownership flags
 *   - verify null-uid without service_role is denied
 *   - verify owner + service_role paths still work
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { assertLocalSafetyOrExit } from "./stage2c-safety.mjs";

assertLocalSafetyOrExit();

const OUT = resolve(process.cwd(), "scripts/.stage2q-artifacts");
mkdirSync(OUT, { recursive: true });
const DB = "stage2q_rehearsal";
const PG = {
  encoding: "utf8",
  env: { ...process.env, PGPASSWORD: "postgres" },
};

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 500) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${String(detail).slice(0, 180)}` : ""}`);
}

function adminSql(sql) {
  return spawnSync(
    "psql",
    ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    PG
  );
}

function psql(sql) {
  const res = spawnSync(
    "psql",
    ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
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
    ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-f", path],
    PG
  );
  return {
    ok: res.status === 0,
    out: ((res.stdout || "") + (res.stderr || "")).trim(),
    status: res.status,
  };
}

function recreateDb() {
  // Free disk: drop leftover Stage 2O/2P rehearsal DBs first.
  const drop = adminSql(`
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname IN ('stage2q_rehearsal','stage2o_rehearsal','stage2p_step') AND pid<>pg_backend_pid();
`);
  // terminate may return 0 rows; ignore
  void drop;
  const recreate = spawnSync(
    "psql",
    [
      "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1",
      "-c", "DROP DATABASE IF EXISTS stage2o_rehearsal;",
      "-c", "DROP DATABASE IF EXISTS stage2p_step;",
      "-c", "DROP DATABASE IF EXISTS stage2q_rehearsal;",
      "-c", "CREATE DATABASE stage2q_rehearsal OWNER postgres;",
    ],
    PG
  );
  if (recreate.status !== 0) {
    throw new Error("Could not create rehearsal DB: " + (recreate.stderr || recreate.stdout));
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
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'role', NULLIF(current_setting('request.jwt.claim.role', true), ''),
      'sub', NULLIF(current_setting('request.jwt.claim.sub', true), '')
    ))
  );
$$;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz, metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1 : greatest(array_length(_parts,1) - 1, 0)];
END $$;
CREATE OR REPLACE FUNCTION storage.filename(name text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[array_length(_parts,1)];
END $$;
CREATE OR REPLACE FUNCTION storage.extension(name text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; _filename text;
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  SELECT _parts[array_length(_parts, 1)] INTO _filename;
  RETURN reverse(split_part(reverse(_filename), '.', 1));
END $$;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
`;

const SEED = `
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a.stage2q@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b.stage2q@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, owner_id, business_name, contact_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Workspace A', 'a.stage2q@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Workspace B', 'b.stage2q@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, workspace_id, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Trader A'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Trader B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.proposals (
  id, workspace_id, proposal_number, status, title,
  customer_name, customer_email, scope_of_work,
  materials, labour, subtotal_amount, vat_amount, total_amount,
  content_revision
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'RF-2Q-A1', 'waiting_for_customer', 'Stage2Q target',
  'Cust A', 'cust.a@example.test', 'Paint',
  '[]'::jsonb, '[]'::jsonb, 78000, 0, 78000,
  0
) ON CONFLICT (id) DO NOTHING;

-- Optional columns if present
DO $$ BEGIN
  BEGIN
    UPDATE public.proposals SET job_summary = 'Hall'
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    UPDATE public.proposals SET customer_access_token = 'tokenAabcdefghijklmnop'
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
END $$;
`;

function acceptExpr(flag, source = "trader_acceptance") {
  return `public.accept_proposal_at_revision(
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    0,
    now(),
    'confirmed',
    '${source}',
    ${flag}
  )::text`;
}

function proposalState() {
  return psql(
    `SELECT status||'|'||coalesce(accepted_at::text,'')||'|'||coalesce(accepted_content_revision::text,'')
     FROM public.proposals WHERE id='cccccccc-cccc-cccc-cccc-cccccccccccc';`
  ).out;
}

function resetProposal() {
  psql(`UPDATE public.proposals SET
    status='waiting_for_customer',
    accepted_at=null,
    booked_at=null,
    booking_confirmation=null,
    accepted_content_revision=null,
    accepted_total_amount=null,
    attention_reason=null
  WHERE id='cccccccc-cccc-cccc-cccc-cccccccccccc';`);
}

function hasAccept() {
  const r = psql(`SELECT count(*)::text FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='accept_proposal_at_revision';`);
  return Number(r.out) > 0;
}

function asRole(role, sub, expr) {
  // Use stdin so the function payload is captured (not just COMMIT).
  const script = `
BEGIN;
SELECT set_config('request.jwt.claim.role', '${role}', true);
SELECT set_config('request.jwt.claim.sub', '${sub || ""}', true);
SELECT set_config('request.jwt.claims', '{"role":"${role}","sub":"${sub || ""}"}', true);
SET LOCAL ROLE ${role};
SELECT ${expr};
ROLLBACK;
`;
  const res = spawnSync(
    "psql",
    ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-tA"],
    { ...PG, input: script }
  );
  const combined = ((res.stdout || "") + "\n" + (res.stderr || "")).trim();
  const lines = combined.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const payload =
    lines.find((l) => /"ok"\s*:/.test(l)) ||
    lines.find((l) => /^ERROR:/i.test(l) || /permission denied/i.test(l)) ||
    lines[lines.length - 1] ||
    "";
  return { ok: res.status === 0, out: payload, raw: combined, status: res.status };
}

function listMigrations() {
  const dir = resolve(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("._"))
    .sort()
    .map((f) => resolve(dir, f));
}

function attackAfterMigration(ver) {
  const g = psql(`
SELECT string_agg(
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || '):' ||
  CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'anonY' ELSE 'anonN' END || '/' ||
  CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'authY' ELSE 'authN' END || '/' ||
  CASE WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'svcY' ELSE 'svcN' END,
  ' | '
)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='accept_proposal_at_revision';`).out;

  const anonY = /anonY/.test(g);
  rec(`${ver}_accept_grants_anon_denied`, !anonY, g);

  const before = proposalState();

  // Anonymous role execution
  const anonAttack = asRole("anon", "", acceptExpr("false"));
  const afterAnon = proposalState();
  const anonBlocked =
    afterAnon === before &&
    (!anonAttack.ok ||
      /Not authorised|permission denied|must be owner|false/i.test(anonAttack.out + anonAttack.raw));
  rec(`${ver}_anon_accept_blocked`, anonBlocked, anonAttack.out || anonAttack.raw);

  // Cross-workspace trader B, flag false
  const crossFalse = asRole(
    "authenticated",
    "22222222-2222-2222-2222-222222222222",
    acceptExpr("false")
  );
  const afterCF = proposalState();
  const cfOk =
    afterCF === before && /Not authorised|"ok": false/i.test(crossFalse.out);
  rec(`${ver}_cross_workspace_flag_false_blocked`, cfOk, crossFalse.out || crossFalse.raw);

  // Cross-workspace trader B, flag true (must still fail — flag cannot disable auth)
  const crossTrue = asRole(
    "authenticated",
    "22222222-2222-2222-2222-222222222222",
    acceptExpr("true")
  );
  const afterCT = proposalState();
  const ctOk =
    afterCT === before && /Not authorised|"ok": false/i.test(crossTrue.out);
  rec(`${ver}_cross_workspace_flag_true_blocked`, ctOk, crossTrue.out || crossTrue.raw);

  // Null uid without service_role
  const nullUid = asRole("authenticated", "", acceptExpr("false"));
  const afterNull = proposalState();
  const nullOk =
    afterNull === before && /Not authorised|"ok": false/i.test(nullUid.out);
  rec(`${ver}_null_uid_without_service_role_blocked`, nullOk, nullUid.out || nullUid.raw);

  // Legitimate owner
  const owner = asRole(
    "authenticated",
    "11111111-1111-1111-1111-111111111111",
    acceptExpr("true")
  );
  const ownerOk = /"ok":\s*true/i.test(owner.out);
  rec(`${ver}_owner_accept_allowed`, ownerOk, owner.out || owner.raw);
  if (ownerOk) resetProposal();

  // Trusted service_role portal path (null uid)
  const svc = asRole("service_role", "", acceptExpr("false", "customer_portal"));
  const svcOk = /"ok":\s*true/i.test(svc.out);
  rec(`${ver}_service_role_portal_allowed`, svcOk, svc.out || svc.raw);
  if (svcOk) resetProposal();

  // Scan other SECURITY DEFINER Stage-2 functions for anon EXECUTE
  const other = psql(`
SELECT string_agg(proname||':'||
  CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'anonY' ELSE 'anonN' END, ',')
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.prosecdef
  AND p.proname IN (
    'save_proposal_revision','issue_proposal_revision',
    'claim_proposal_revision_send','write_proposal_schedule_slot'
  );`).out;
  if (other) {
    const leak = /:anonY/.test(other);
    rec(`${ver}_other_stage2_definer_anon_denied`, !leak, other);
  }

  return !anonY && anonBlocked && cfOk && ctOk && nullOk && ownerOk && svcOk;
}

function main() {
  recreateDb();
  const boot = spawnSync(
    "psql",
    ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-c", BOOTSTRAP],
    PG
  );
  if (boot.status !== 0) {
    throw new Error("bootstrap failed: " + (boot.stderr || boot.stdout));
  }

  const files = listMigrations();
  let firstAcceptProtection = null;
  let seeded = false;
  let stop = false;

  for (const f of files) {
    const base = basename(f, ".sql");
    const ver = base.split("_")[0];
    const applied = psqlFile(f);
    if (!applied.ok) {
      rec(`apply_${ver}`, false, applied.out.slice(-600));
      stop = true;
      break;
    }
    rec(`apply_${ver}`, true);
    psql(
      `INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${ver}','${base}') ON CONFLICT (version) DO NOTHING;`
    );

    // Seed once content_revision exists (first Stage 2G migration).
    if (ver === "20261103010000" && !seeded) {
      const seed = spawnSync(
        "psql",
        ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-c", SEED],
        PG
      );
      seeded = seed.status === 0;
      rec("seed_fictional_workspaces", seeded, (seed.stderr || seed.stdout || "").toString().slice(0, 240));
      if (!seeded) {
        stop = true;
        break;
      }
    }

    if (!hasAccept() || !seeded) continue;

    const protectedOk = attackAfterMigration(ver);
    if (protectedOk && !firstAcceptProtection) {
      firstAcceptProtection = ver;
      rec("first_accept_protection_established_at", true, ver);
    }
  }

  if (!stop) {
    // Final-schema: 4-arg issue must be unambiguous
    const overload = psql(`SELECT public.issue_proposal_revision(
      '00000000-0000-0000-0000-000000000001'::uuid, 1, 'simulated'::text, 'x'::text
    )::text;`);
    rec(
      "final_issue_4arg_unambiguous",
      overload.ok &&
        /You must be signed in|No unsent|not found|Not authorised|Could not find/i.test(overload.out) &&
        !/is not unique/i.test(overload.out),
      overload.out
    );

    // Final-schema accept still protected
    if (hasAccept() && seeded) {
      attackAfterMigration("final_schema");
    }
  }

  const mainCount = adminSql(
    `select count(*)::text from supabase_migrations.schema_migrations;`
  );
  const mainOut = ((mainCount.stdout || "").match(/\b\d+\b/) || [])[0] || "";
  rec("main_db_tracker_unchanged", mainOut === "27", `count=${mainOut}`);

  writeFileSync(
    resolve(OUT, "results.json"),
    JSON.stringify({ results, firstAcceptProtection, stop }, null, 2)
  );

  const failed = results.filter((x) => !x.ok);
  console.log("\n=== Stage 2Q migration security summary ===");
  console.log(`total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`);
  console.log(`first_accept_protection=${firstAcceptProtection || "NONE"}`);
  if (failed.length) {
    for (const f of failed) console.error(`FAIL: ${f.name} — ${f.detail}`);
    process.exit(1);
  }
  console.log("PASS: all Stage 2Q migration security checks");
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
