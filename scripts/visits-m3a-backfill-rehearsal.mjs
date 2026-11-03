#!/usr/bin/env node
/**
 * Milestone 3A — historical visits backfill rehearsal.
 * Applies Stage 2 + M1, seeds representative history, applies M3A twice.
 * Local only. No Production. No email.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { assertLocalSafetyOrExit } from "./stage2c-safety.mjs";

assertLocalSafetyOrExit();

const DB = "visits_m3a_rehearsal";
const PG = {
  encoding: "utf8",
  env: { ...process.env, PGPASSWORD: "postgres" },
};
const M3A = "20261104020000_visits_historical_backfill.sql";

function admin(args) {
  return spawnSync(
    "psql",
    ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", ...args],
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
  };
}

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${String(detail).slice(0, 180)}` : ""}`);
}

const BOOTSTRAP = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT anon TO postgres; GRANT authenticated TO postgres; GRANT service_role TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
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
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; BEGIN SELECT string_to_array(name,'/') INTO _parts; RETURN _parts[1:greatest(array_length(_parts,1)-1,0)]; END $$;
CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; BEGIN SELECT string_to_array(name,'/') INTO _parts; RETURN _parts[array_length(_parts,1)]; END $$;
CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; _filename text; BEGIN SELECT string_to_array(name,'/') INTO _parts; SELECT _parts[array_length(_parts,1)] INTO _filename; RETURN reverse(split_part(reverse(_filename),'.',1)); END $$;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY, statements text[], name text
);
`;

admin([
  "-c",
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid<>pg_backend_pid();`,
]);
const recreate = admin([
  "-c", `DROP DATABASE IF EXISTS ${DB};`,
  "-c", `CREATE DATABASE ${DB} OWNER postgres;`,
]);
if (recreate.status !== 0) {
  console.error(recreate.stderr || recreate.stdout);
  process.exit(1);
}

const boot = spawnSync(
  "psql",
  ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-c", BOOTSTRAP],
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
  if (file === M3A) continue; // apply after seed
  const applied = psqlFile(resolve(dir, file));
  if (!applied.ok) {
    rec(`migrate ${file}`, false, applied.out);
    console.error(applied.out);
    process.exit(1);
  }
  const ver = basename(file).slice(0, 14);
  psql(
    `INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${ver}','${basename(file)}') ON CONFLICT DO NOTHING;`
  );
}
rec("Stage 2 + Milestone 1 applied before seed", true);

const seed = psql(`
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a.m3a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b.m3a@example.test')
ON CONFLICT DO NOTHING;

INSERT INTO public.workspaces (id, owner_id, business_name, contact_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Workspace A', 'a.m3a@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Workspace B', 'b.m3a@example.test')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, workspace_id, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Trader A'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Trader B')
ON CONFLICT DO NOTHING;

-- Enquiries
INSERT INTO public.enquiries (id, workspace_id, customer_name, customer_email, customer_mobile, address_line_1, town, postcode, status, project_description, service_requested) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Capture Only', 'c1@example.test', '07001', '1 Capture St', 'Leeds', 'LS1 1AA', 'site_visit_booked', 'Kitchen', 'Plumbing'),
  ('e1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Booking Only', 'c2@example.test', '07002', '2 Book St', 'Leeds', 'LS1 2AA', 'site_visit_booked', 'Bath', 'Tiling'),
  ('e1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Matched Pair', 'c3@example.test', '07003', '3 Match St', 'York', 'YO1 1AA', 'site_visit_booked', 'Roof', 'Roofing'),
  ('e1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ambiguous Multi', 'c4@example.test', '07004', '4 Multi St', 'York', 'YO1 2AA', 'site_visit_booked', 'Extension', 'Building'),
  ('e1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'No Date Capture', 'c5@example.test', '07005', '5 Nodate St', 'Hull', 'HU1 1AA', 'site_visit_booked', 'Fence', 'Garden'),
  ('e1000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Completed Capture', 'c6@example.test', '07006', '6 Done St', 'Hull', 'HU1 2AA', 'site_visit_completed', 'Loft', 'Insulation'),
  ('e1000000-0000-4000-8000-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other Workspace', 'c7@example.test', '07007', '7 Other St', 'York', 'YO1 3AA', 'site_visit_booked', 'Deck', 'Carpentry');

-- Capture-only with photos/notes
INSERT INTO public.site_visits (id, workspace_id, enquiry_id, slot_label, starts_at, date_iso, notes, measurements, checklist, voice_notes) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000001',
   '10 Nov 2026 at 10:00', '2026-11-10T10:00:00Z', '2026-11-10',
   'KEEP NOTES capture-only', '[{"label":"width","value":"2m"}]'::jsonb,
   '[{"id":"photos","label":"Photos","done":true}]'::jsonb, '[]'::jsonb);

INSERT INTO public.enquiry_media (workspace_id, enquiry_id, site_visit_id, kind, storage_path, file_name, mime_type, byte_size)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'e1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'photo',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/e1000000-0000-4000-8000-000000000001/a1000000-0000-4000-8000-000000000001/media1.jpg',
  'keep-me.jpg',
  'image/jpeg',
  1234
);

-- Booking-only (no capture), missing token
INSERT INTO public.visits (
  id, workspace_id, enquiry_id, customer_name, contact_email, address_line_1, town, postcode,
  visit_type, visit_date, visit_time, duration_minutes, status, notes, enquiry_summary
) VALUES (
  'b1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000002',
  'Booking Only', 'c2@example.test', '2 Book St', 'Leeds', 'LS1 2AA',
  'initial_assessment', '2026-11-11', '11:00', 60, 'scheduled', '', 'Bath'
);

-- Matching booking + capture (unlinked), booking has token already
INSERT INTO public.visits (
  id, workspace_id, enquiry_id, customer_name, contact_email, address_line_1, town, postcode,
  visit_type, visit_date, visit_time, duration_minutes, status, notes, enquiry_summary,
  customer_access_token, starts_at, slot_label
) VALUES (
  'b1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000003',
  'Matched Pair', 'c3@example.test', '3 Match St', 'York', 'YO1 1AA',
  'initial_assessment', '2026-11-12', '12:00', 60, 'scheduled', '', 'Roof',
  'ExistingTokenKeepAAAAAAAAAAAAAAAA', '2026-11-12T12:00:00Z', '12 Nov at 12:00'
);
INSERT INTO public.site_visits (id, workspace_id, enquiry_id, slot_label, starts_at, date_iso, notes, measurements, checklist, voice_notes) VALUES
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000003',
   '12 Nov at 12:00', '2026-11-12T12:00:00Z', '2026-11-12',
   'KEEP NOTES matched', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);

-- Ambiguous: two visits + one unlinked capture
INSERT INTO public.visits (
  id, workspace_id, enquiry_id, customer_name, visit_type, visit_date, visit_time, duration_minutes, status, customer_access_token
) VALUES
  ('b1000000-0000-4000-8000-000000000041', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000004',
   'Ambiguous Multi', 'initial_assessment', '2026-11-13', '09:00', 60, 'scheduled', 'AmbiguousTokenOneAAAAAAAAAAAAAAA'),
  ('b1000000-0000-4000-8000-000000000042', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000004',
   'Ambiguous Multi', 'follow_up', '2026-11-20', '15:00', 60, 'scheduled', 'AmbiguousTokenTwoAAAAAAAAAAAAAAA');
INSERT INTO public.site_visits (id, workspace_id, enquiry_id, slot_label, starts_at, date_iso, notes) VALUES
  ('a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000004',
   'unclear', '2026-11-14T10:00:00Z', '2026-11-14', 'KEEP NOTES ambiguous');

-- Missing date capture-only
INSERT INTO public.site_visits (id, workspace_id, enquiry_id, notes) VALUES
  ('a1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000005',
   'KEEP NOTES no-date');

-- Completed capture-only
INSERT INTO public.site_visits (id, workspace_id, enquiry_id, slot_label, starts_at, date_iso, completed_at, notes) VALUES
  ('a1000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-4000-8000-000000000006',
   'Done', '2026-10-01T09:00:00Z', '2026-10-01', '2026-10-01T10:00:00Z', 'KEEP NOTES completed');

-- Cancelled booking-only (no token)
INSERT INTO public.visits (
  id, workspace_id, enquiry_id, customer_name, visit_type, visit_date, duration_minutes, status
) VALUES (
  'b1000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL,
  'Cancelled Standalone', 'follow_up', '2026-09-01', 30, 'cancelled'
);

-- Other workspace capture-only
INSERT INTO public.site_visits (id, workspace_id, enquiry_id, date_iso, starts_at, notes) VALUES
  ('a1000000-0000-4000-8000-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e1000000-0000-4000-8000-000000000007',
   '2026-11-18', '2026-11-18T13:00:00Z', 'KEEP NOTES workspace B');
`);
rec("seed historical fixtures", seed.ok, seed.out);
if (!seed.ok) {
  console.error(seed.out);
  process.exit(1);
}

const beforeTokens = psql(`
SELECT customer_access_token FROM public.visits
 WHERE id = 'b1000000-0000-4000-8000-000000000003';
`).out;

const apply1 = psqlFile(resolve(dir, M3A));
rec("apply M3A backfill first run", apply1.ok, apply1.out);
if (!apply1.ok) {
  console.error(apply1.out);
  process.exit(1);
}
psql(
  `INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('20261104020000','${M3A}') ON CONFLICT DO NOTHING;`
);

const summary1 = psql(`
SELECT detail FROM public.visits_unification_backfill_log
 WHERE action = 'run_completed'
 ORDER BY created_at DESC LIMIT 1;
`);
rec("audit run_completed present", summary1.ok && summary1.out.includes("linked="), summary1.out);

rec(
  "capture-only created booking + linked",
  psql(`
SELECT (sv.visit_id IS NOT NULL AND v.source_site_visit_id = sv.id AND v.status = 'scheduled')::text
FROM public.site_visits sv
JOIN public.visits v ON v.id = sv.visit_id
WHERE sv.id = 'a1000000-0000-4000-8000-000000000001';
`).out === "true"
);

rec(
  "capture notes preserved",
  psql(`SELECT notes FROM public.site_visits WHERE id='a1000000-0000-4000-8000-000000000001';`).out.includes(
    "KEEP NOTES capture-only"
  )
);

rec(
  "photo media still attached",
  psql(`
SELECT COUNT(*)::text FROM public.enquiry_media
 WHERE site_visit_id = 'a1000000-0000-4000-8000-000000000001';
`).out === "1"
);

rec(
  "booking-only received token",
  psql(`
SELECT (customer_access_token IS NOT NULL AND length(customer_access_token)=32)::text
FROM public.visits WHERE id='b1000000-0000-4000-8000-000000000002';
`).out === "true"
);

rec(
  "matched pair linked without changing existing token",
  psql(`
SELECT (sv.visit_id = 'b1000000-0000-4000-8000-000000000003'
    AND v.customer_access_token = 'ExistingTokenKeepAAAAAAAAAAAAAAAA'
    AND sv.notes = 'KEEP NOTES matched')::text
FROM public.site_visits sv
JOIN public.visits v ON v.id = sv.visit_id
WHERE sv.id = 'a1000000-0000-4000-8000-000000000003';
`).out === "true"
);

rec(
  "ambiguous multi left unlinked",
  psql(`
SELECT (visit_id IS NULL AND notes = 'KEEP NOTES ambiguous')::text
FROM public.site_visits WHERE id='a1000000-0000-4000-8000-000000000004';
`).out === "true"
);

rec(
  "ambiguous skip logged",
  psql(`
SELECT COUNT(*)::text FROM public.visits_unification_backfill_log
 WHERE action = 'skip_ambiguous_multiple_visits'
   AND site_visit_id = 'a1000000-0000-4000-8000-000000000004';
`).out !== "0"
);

rec(
  "missing date skipped",
  psql(`
SELECT (visit_id IS NULL)::text FROM public.site_visits
 WHERE id='a1000000-0000-4000-8000-000000000005';
`).out === "true" &&
    psql(`
SELECT COUNT(*)::text FROM public.visits_unification_backfill_log
 WHERE action='skip_no_date' AND site_visit_id='a1000000-0000-4000-8000-000000000005';
`).out !== "0"
);

rec(
  "completed capture became completed visit",
  psql(`
SELECT (v.status = 'completed' AND sv.notes = 'KEEP NOTES completed')::text
FROM public.site_visits sv
JOIN public.visits v ON v.id = sv.visit_id
WHERE sv.id = 'a1000000-0000-4000-8000-000000000006';
`).out === "true"
);

rec(
  "cancelled booking kept cancelled and gained token",
  psql(`
SELECT (status = 'cancelled' AND customer_access_token IS NOT NULL)::text
FROM public.visits WHERE id='b1000000-0000-4000-8000-000000000008';
`).out === "true"
);

rec(
  "workspace B capture linked/created in workspace B only",
  psql(`
SELECT (v.workspace_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND sv.notes = 'KEEP NOTES workspace B')::text
FROM public.site_visits sv
JOIN public.visits v ON v.id = sv.visit_id
WHERE sv.id = 'a1000000-0000-4000-8000-000000000007';
`).out === "true"
);

const visitsAfterFirst = psql(`SELECT COUNT(*)::text FROM public.visits;`).out;
const tokensAfterFirst = psql(`
SELECT COUNT(*)::text FROM public.visits WHERE customer_access_token IS NOT NULL;
`).out;
const existingToken = psql(`
SELECT customer_access_token FROM public.visits
 WHERE id = 'b1000000-0000-4000-8000-000000000003';
`).out;

const apply2 = psqlFile(resolve(dir, M3A));
rec("apply M3A backfill second run (idempotent)", apply2.ok, apply2.out);

rec(
  "second run did not add visits",
  psql(`SELECT COUNT(*)::text FROM public.visits;`).out === visitsAfterFirst,
  `before=${visitsAfterFirst}`
);

rec(
  "second run did not rotate existing token",
  psql(`
SELECT customer_access_token FROM public.visits
 WHERE id = 'b1000000-0000-4000-8000-000000000003';
`).out === existingToken && existingToken === beforeTokens
);

rec(
  "second run created no extra tokens beyond already-tokened set",
  psql(`
SELECT COUNT(*)::text FROM public.visits WHERE customer_access_token IS NOT NULL;
`).out === tokensAfterFirst
);

rec(
  "Stage 2 proposal_revisions still present",
  psql(`SELECT to_regclass('public.proposal_revisions') IS NOT NULL`).out === "t"
);

const failed = results.filter((r) => !r.ok);
console.log("\n=== Visits M3A backfill rehearsal ===");
console.log(`passed ${results.length - failed.length}/${results.length}`);
console.log("first run summary:", summary1.out);
if (failed.length) {
  for (const f of failed) console.log("FAIL", f.name, f.detail);
  process.exit(1);
}
console.log("PASS: visits M3A backfill rehearsal");
