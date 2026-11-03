#!/usr/bin/env node
/**
 * Milestone 5 — local DB rehearsal: capture-per-visit + constraint swap.
 * Applies 20261104030000 additively. Never touches Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { assertLocalSafetyOrExit } from "./stage2c-safety.mjs";

assertLocalSafetyOrExit();

const PG = {
  encoding: "utf8",
  env: { ...process.env, PGPASSWORD: "postgres" },
};

function psql(db, sql) {
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
      db,
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
  };
}

function psqlFile(db, filePath) {
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
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      filePath,
    ],
    PG
  );
  return {
    ok: res.status === 0,
    out: ((res.stdout || "") + (res.stderr || "")).trim(),
  };
}

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail.slice(0, 180)}` : ""}`
  );
}

const dbProbe = psql(
  "postgres",
  "SELECT datname FROM pg_database WHERE datname IN ('visits_m3a_rehearsal','visits_m1_rehearsal') ORDER BY 1 DESC LIMIT 1;"
);
const SOURCE = dbProbe.out || "visits_m1_rehearsal";
const DB = "visits_m5_rehearsal";

if (!dbProbe.out) {
  console.error("No source rehearsal DB. Run earlier visits rehearsals first.");
  process.exit(1);
}

psql("postgres", `DROP DATABASE IF EXISTS ${DB};`);
const created = psql("postgres", `CREATE DATABASE ${DB} TEMPLATE ${SOURCE};`);
if (!created.ok) {
  console.error("Could not create", DB, created.out);
  process.exit(1);
}
rec("cloned rehearsal db", true, `${SOURCE} -> ${DB}`);

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261104030000_site_visits_capture_per_visit.sql"
);
const applied = psqlFile(DB, migrationPath);
rec("applied capture-per-visit migration", applied.ok, applied.out);

rec(
  "enquiry_id unique constraint removed",
  psql(
    DB,
    `SELECT COUNT(*)::text FROM pg_constraint
     WHERE conrelid = 'public.site_visits'::regclass
       AND contype = 'u'
       AND conname = 'site_visits_enquiry_id_key';`
  ).out === "0"
);

rec(
  "visit_id unique index present",
  psql(
    DB,
    `SELECT COUNT(*)::text FROM pg_indexes
     WHERE tablename = 'site_visits' AND indexname = 'site_visits_visit_id_uidx';`
  ).out === "1"
);

rec(
  "historical review table present",
  psql(DB, `SELECT to_regclass('public.site_visits_historical_review') IS NOT NULL`).out ===
    "t"
);

// Seed: one enquiry, two visits, two captures + one historical unlinked.
const seed = psql(
  DB,
  `
DO $$
DECLARE
  ws uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  enq uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeee00a5';
  v1 uuid := '10000000-0000-4000-8000-0000000000a1';
  v2 uuid := '10000000-0000-4000-8000-0000000000a2';
  sv1 uuid := '20000000-0000-4000-8000-0000000000a1';
  sv2 uuid := '20000000-0000-4000-8000-0000000000a2';
  svh uuid := '20000000-0000-4000-8000-0000000000af';
BEGIN
  INSERT INTO public.enquiries (
    id, workspace_id, customer_name, customer_mobile, customer_email,
    service_requested, address_line_1, town, postcode, project_description, status
  ) VALUES (
    enq, ws, 'M5 Customer', '07700900111', 'm5@example.com',
    'Joinery', '1 Test Road', 'Leeds', 'LS1 1AA', 'Kitchen', 'site_visit_booked'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.visits (
    id, workspace_id, enquiry_id, customer_name, visit_type, visit_date, visit_time,
    duration_minutes, status, customer_access_token, starts_at, slot_label, notes
  ) VALUES
  (
    v1, ws, enq, 'M5 Customer', 'initial_assessment', '2026-01-15', '10:00',
    60, 'scheduled', 'TokenM5InitialAAAAAAAAAAAAAAAAAA',
    '2026-01-15T10:00:00.000Z', '15 January 2026 at 10:00', 'initial notes field'
  ),
  (
    v2, ws, enq, 'M5 Customer', 'follow_up', '2026-07-01', '10:00',
    60, 'scheduled', 'TokenM5FollowUpAAAAAAAAAAAAAAAAA',
    '2026-07-01T09:00:00.000Z', '1 July 2026 at 10:00', 'follow notes field'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.site_visits (
    id, workspace_id, enquiry_id, visit_id, slot_label, starts_at, date_iso,
    notes, measurements, checklist, voice_notes
  ) VALUES
  (
    sv1, ws, enq, v1, '15 January 2026 at 10:00', '2026-01-15T10:00:00.000Z', '2026-01-15',
    'Initial capture notes', '[{"label":"width","value":"2m"}]'::jsonb,
    '[{"id":"photos","label":"Photos","done":true}]'::jsonb, '[]'::jsonb
  ),
  (
    sv2, ws, enq, v2, '1 July 2026 at 10:00', '2026-07-01T09:00:00.000Z', '2026-07-01',
    'Follow-up capture notes', '[{"label":"depth","value":"1m"}]'::jsonb,
    '[{"id":"access","label":"Access","done":false}]'::jsonb, '[]'::jsonb
  ),
  (
    svh, ws, enq, NULL, 'Historical slot', '2026-05-01T09:00:00.000Z', '2026-05-01',
    'Ambiguous historical capture', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.visits SET source_site_visit_id = sv1 WHERE id = v1;
  UPDATE public.visits SET source_site_visit_id = sv2 WHERE id = v2;

  INSERT INTO public.site_visits_historical_review (site_visit_id, workspace_id, enquiry_id, reason)
  VALUES (svh, ws, enq, 'unlinked_enquiry_level_capture')
  ON CONFLICT (site_visit_id) DO NOTHING;
END $$;
`
);
rec("seeded two visits + separate captures + historical", seed.ok, seed.out);

rec(
  "two visits share one enquiry",
  psql(
    DB,
    `SELECT COUNT(*)::text FROM public.visits
     WHERE enquiry_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee00a5';`
  ).out === "2"
);

rec(
  "two linked captures for that enquiry",
  psql(
    DB,
    `SELECT COUNT(*)::text FROM public.site_visits
     WHERE enquiry_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee00a5'
       AND visit_id IS NOT NULL;`
  ).out === "2"
);

rec(
  "captures keep separate notes",
  psql(
    DB,
    `SELECT COUNT(*)::text FROM public.site_visits
     WHERE enquiry_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee00a5'
       AND notes IN ('Initial capture notes','Follow-up capture notes');`
  ).out === "2"
);

rec(
  "historical unlinked capture preserved",
  psql(
    DB,
    `SELECT notes FROM public.site_visits
     WHERE id = '20000000-0000-4000-8000-0000000000af';`
  ).out.includes("Ambiguous historical capture")
);

rec(
  "historical review flags unlinked capture",
  psql(
    DB,
    `SELECT COUNT(*)::text FROM public.site_visits_historical_review
     WHERE site_visit_id = '20000000-0000-4000-8000-0000000000af';`
  ).out === "1"
);

rec(
  "duplicate visit_id capture blocked",
  !psql(
    DB,
    `INSERT INTO public.site_visits (
      id, workspace_id, enquiry_id, visit_id, notes, measurements, checklist, voice_notes
    ) VALUES (
      '20000000-0000-4000-8000-0000000000ad',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'eeeeeeee-eeee-eeee-eeee-eeeeeeee00a5',
      '10000000-0000-4000-8000-0000000000a1',
      'dup', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
    );`
  ).ok
);

rec(
  "winter starts_at stays 10:00Z for GMT appointment",
  psql(
    DB,
    `SELECT starts_at::text FROM public.visits
     WHERE id = '10000000-0000-4000-8000-0000000000a1';`
  ).out.startsWith("2026-01-15 10:00:00")
);

rec(
  "summer starts_at is 09:00Z for 10:00 BST appointment",
  psql(
    DB,
    `SELECT starts_at::text FROM public.visits
     WHERE id = '10000000-0000-4000-8000-0000000000a2';`
  ).out.startsWith("2026-07-01 09:00:00")
);

rec(
  "workspace isolation still holds for tokens",
  psql(
    DB,
    `SELECT COUNT(*)::text FROM public.visits v
     JOIN public.workspaces w ON w.id = v.workspace_id
     WHERE v.customer_access_token = 'TokenM5InitialAAAAAAAAAAAAAAAAAA'
       AND w.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';`
  ).out === "1"
);

const failed = results.filter((r) => !r.ok);
console.log("\n=== Visits M5 capture + timezone rehearsal ===");
console.log(`passed ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  process.exit(1);
}
console.log("PASS: visits M5 capture + timezone rehearsal");
