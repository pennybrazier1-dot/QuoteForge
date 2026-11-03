#!/usr/bin/env node
/**
 * Milestone 3B — local SQL lifecycle checks for reschedule/cancel semantics.
 * Uses visits_m3a_rehearsal if present, else visits_m1_rehearsal.
 */
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
    ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
    PG
  );
  return { ok: res.status === 0, out: ((res.stdout || "") + (res.stderr || "")).trim() };
}

const dbCheck = psql("postgres", "SELECT datname FROM pg_database WHERE datname IN ('visits_m3a_rehearsal','visits_m1_rehearsal') ORDER BY 1 DESC LIMIT 1;");
const DB = dbCheck.out || "visits_m3a_rehearsal";
if (!dbCheck.out) {
  console.error("No rehearsal DB found. Run visits-m3a-backfill-rehearsal.mjs first.");
  process.exit(1);
}

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
}

rec("using rehearsal db", true, DB);

const seed = psql(DB, `
INSERT INTO public.visits (
  id, workspace_id, customer_name, visit_type, visit_date, visit_time, duration_minutes,
  status, customer_access_token, starts_at, slot_label, notes
) VALUES (
  'c1000000-0000-4000-8000-00000000b301',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Lifecycle Test',
  'initial_assessment',
  '2026-11-21',
  '09:00',
  60,
  'scheduled',
  'LifecycleTokenBBBBBBBBBBBBBBBBBBB',
  '2026-11-21T09:00:00Z',
  '21 Nov at 09:00',
  'KEEP NOTES lifecycle'
) ON CONFLICT (id) DO UPDATE SET
  visit_date = EXCLUDED.visit_date,
  visit_time = EXCLUDED.visit_time,
  status = 'scheduled',
  customer_access_token = EXCLUDED.customer_access_token,
  notes = EXCLUDED.notes
RETURNING id;
`);
rec("seed lifecycle visit", seed.ok, seed.out);

const tokenBefore = psql(DB, `
SELECT customer_access_token FROM public.visits WHERE id='c1000000-0000-4000-8000-00000000b301';
`).out;

const reschedule = psql(DB, `
UPDATE public.visits SET
  visit_date = '2026-11-28',
  visit_time = '15:30',
  starts_at = '2026-11-28T15:30:00Z',
  slot_label = '28 Nov at 15:30'
WHERE id = 'c1000000-0000-4000-8000-00000000b301'
  AND status IN ('scheduled','confirmed')
RETURNING visit_date || ' ' || visit_time || ' ' || customer_access_token || ' ' || notes;
`);
rec(
  "reschedule updates datetime and preserves token/notes",
  reschedule.ok &&
    reschedule.out.includes("2026-11-28 15:30") &&
    reschedule.out.includes(tokenBefore) &&
    reschedule.out.includes("KEEP NOTES lifecycle"),
  reschedule.out
);

const cancel = psql(DB, `
UPDATE public.visits SET status = 'cancelled'
WHERE id = 'c1000000-0000-4000-8000-00000000b301'
  AND status IN ('scheduled','confirmed')
RETURNING status || ' ' || customer_access_token || ' ' || notes;
`);
rec(
  "cancel sets cancelled and keeps token/notes",
  cancel.ok &&
    cancel.out.startsWith("cancelled ") &&
    cancel.out.includes(tokenBefore) &&
    cancel.out.includes("KEEP NOTES lifecycle"),
  cancel.out
);

rec(
  "calendar filter would exclude cancelled",
  psql(DB, `
SELECT COUNT(*)::text FROM public.visits
 WHERE id='c1000000-0000-4000-8000-00000000b301'
   AND status IN ('scheduled','confirmed','completed');
`).out === "0"
);

rec(
  "public confirmation row still loadable by token",
  psql(DB, `
SELECT status FROM public.visits
 WHERE customer_access_token='LifecycleTokenBBBBBBBBBBBBBBBBBBB';
`).out === "cancelled"
);

const reopenBlocked = psql(DB, `
WITH updated AS (
  UPDATE public.visits SET
    visit_date = '2026-12-01'
  WHERE id = 'c1000000-0000-4000-8000-00000000b301'
    AND status IN ('scheduled','confirmed')
  RETURNING id
)
SELECT COUNT(*)::text FROM updated;
`);
rec(
  "reschedule filter does not update cancelled visit",
  reopenBlocked.ok && reopenBlocked.out === "0",
  reopenBlocked.out
);

const failed = results.filter((r) => !r.ok);
console.log("\n=== Visits M3B lifecycle rehearsal ===");
console.log(`passed ${results.length - failed.length}/${results.length}`);
if (failed.length) process.exit(1);
console.log("PASS: visits M3B lifecycle rehearsal");
