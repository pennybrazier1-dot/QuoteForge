#!/usr/bin/env node
/**
 * Unified visits Milestone 1 — isolated migration rehearsal.
 * Applies the full local migration chain (including Stage 2) then M1 foundation.
 * Does NOT touch Production. Does NOT send email.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { assertLocalSafetyOrExit } from "./stage2c-safety.mjs";

assertLocalSafetyOrExit();

const DB = "visits_m1_rehearsal";
const PG = {
  encoding: "utf8",
  env: { ...process.env, PGPASSWORD: "postgres" },
};

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

function recreateDb() {
  adminSql(`
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = '${DB}' AND pid <> pg_backend_pid();
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
      `DROP DATABASE IF EXISTS ${DB};`,
      "-c",
      `CREATE DATABASE ${DB} OWNER postgres;`,
    ],
    PG
  );
  if (recreate.status !== 0) {
    throw new Error(
      "Could not create rehearsal DB: " + (recreate.stderr || recreate.stdout)
    );
  }
}

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 400) });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${String(detail).slice(0, 180)}` : ""}`
  );
}

recreateDb();
const boot = spawnSync(
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
    "-c",
    BOOTSTRAP,
  ],
  PG
);
if (boot.status !== 0) {
  console.error(boot.stderr || boot.stdout);
  process.exit(1);
}

const dir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && !f.startsWith("._"))
  .sort();

for (const file of files) {
  const path = resolve(dir, file);
  const applied = psqlFile(path);
  const ver = basename(file).slice(0, 14);
  if (!applied.ok) {
    rec(`migrate ${file}`, false, applied.out);
    console.error(applied.out);
    process.exit(1);
  }
  psql(
    `INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${ver}','${basename(file)}') ON CONFLICT (version) DO NOTHING;`
  );
  if (file.includes("20261104010000")) {
    rec(`migrate ${file}`, true);
  }
}

rec(
  "M1 columns on visits",
  psql(`
SELECT COUNT(*)::text FROM information_schema.columns
 WHERE table_schema='public' AND table_name='visits'
   AND column_name IN ('customer_access_token','starts_at','slot_label','source_site_visit_id');
`).out.trim() === "4"
);

rec(
  "M1 visit_id on site_visits",
  psql(`
SELECT COUNT(*)::text FROM information_schema.columns
 WHERE table_schema='public' AND table_name='site_visits' AND column_name='visit_id';
`).out.trim() === "1"
);

rec(
  "token unique index exists",
  psql(`
SELECT COUNT(*)::text FROM pg_indexes
 WHERE schemaname='public' AND indexname='visits_customer_access_token_uidx';
`).out.trim() === "1"
);

rec(
  "active initial unique index exists",
  psql(`
SELECT COUNT(*)::text FROM pg_indexes
 WHERE schemaname='public' AND indexname='visits_one_active_initial_per_enquiry';
`).out.trim() === "1"
);

rec(
  "Stage 2 revision table still present",
  psql(`SELECT to_regclass('public.proposal_revisions') IS NOT NULL`).out.trim() ===
    "t"
);

const seed = psql(`
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a.visits-m1@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, owner_id, business_name, contact_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'M1 Visit Co', 'a.visits-m1@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, workspace_id, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Trader A')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.enquiries (
  id, workspace_id, customer_name, status, project_description
) VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Customer One',
  'reviewing',
  'Kitchen'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.visits (
  id, workspace_id, enquiry_id, customer_name, visit_type, visit_date, visit_time,
  duration_minutes, status, customer_access_token, starts_at, slot_label, enquiry_summary,
  address_line_1, town, postcode
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001',
  'Customer One',
  'initial_assessment',
  '2026-11-10',
  '10:00',
  60,
  'scheduled',
  'TokenCustomerOneAAAAAAAAAAAAAAAA',
  '2026-11-10T10:00:00.000Z',
  '10 November 2026 at 10:00',
  'Kitchen measure',
  '1 High Street',
  'Leeds',
  'LS1 1AA'
);

INSERT INTO public.visits (
  id, workspace_id, customer_name, visit_type, visit_date, visit_time,
  duration_minutes, status, customer_access_token, starts_at, slot_label, enquiry_summary,
  address_line_1, town, postcode
) VALUES (
  '10000000-0000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Customer Two',
  'follow_up',
  '2026-11-11',
  '11:00',
  60,
  'cancelled',
  'TokenCustomerTwoBBBBBBBBBBBBBBBBBB',
  '2026-11-11T11:00:00.000Z',
  '11 November 2026 at 11:00',
  'Follow up',
  '2 Low Road',
  'York',
  'YO1 1AA'
);
`);
rec("seed visits", seed.ok, seed.out);

const dupToken = psql(`
INSERT INTO public.visits (
  workspace_id, customer_name, visit_type, visit_date, duration_minutes, status, customer_access_token
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Dup',
  'follow_up',
  '2026-11-12',
  60,
  'scheduled',
  'TokenCustomerOneAAAAAAAAAAAAAAAA'
);
`);
rec("token uniqueness enforced", !dupToken.ok, dupToken.out);

const isolation = psql(`
SELECT customer_name FROM public.visits
 WHERE customer_access_token = 'TokenCustomerOneAAAAAAAAAAAAAAAA';
`);
rec(
  "token loads only matching visit",
  isolation.ok && isolation.out.trim() === "Customer One",
  isolation.out
);

const other = psql(`
SELECT customer_name FROM public.visits
 WHERE customer_access_token = 'TokenCustomerTwoBBBBBBBBBBBBBBBBBB';
`);
rec(
  "unrelated token cannot see other customer",
  other.ok && other.out.trim() === "Customer Two",
  other.out
);

const cancelled = psql(`
SELECT status FROM public.visits
 WHERE customer_access_token = 'TokenCustomerTwoBBBBBBBBBBBBBBBBBB';
`);
rec(
  "cancelled status readable by token",
  cancelled.ok && cancelled.out.trim() === "cancelled",
  cancelled.out
);

const dupInitial = psql(`
INSERT INTO public.visits (
  workspace_id, enquiry_id, customer_name, visit_type, visit_date, duration_minutes, status, customer_access_token
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001',
  'Customer One',
  'initial_assessment',
  '2026-11-13',
  60,
  'scheduled',
  'TokenDupInitialCCCCCCCCCCCCCCCCCC'
);
`);
rec("active initial per enquiry unique", !dupInitial.ok, dupInitial.out);

const failed = results.filter((r) => !r.ok);
console.log("\n=== Visits M1 foundation rehearsal ===");
console.log(`passed ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log("FAIL", f.name, f.detail);
  process.exit(1);
}
console.log("PASS: visits M1 foundation rehearsal");
