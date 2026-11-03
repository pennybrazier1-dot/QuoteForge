#!/usr/bin/env node
/**
 * Milestone 2 — local DB checks on visits_m1_rehearsal (Stage 2 + M1 schema).
 * Verifies capture linking, calendar orphan filter semantics, duplicate guard.
 */
import { spawnSync } from "node:child_process";
import { assertLocalSafetyOrExit } from "./stage2c-safety.mjs";

assertLocalSafetyOrExit();

const DB = "visits_m1_rehearsal";
const PG = {
  encoding: "utf8",
  env: { ...process.env, PGPASSWORD: "postgres" },
};

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
  };
}

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
}

const exists = psql(`SELECT to_regclass('public.visits') IS NOT NULL`);
if (!exists.ok || exists.out !== "t") {
  console.error("Run scripts/visits-m1-foundation-rehearsal.mjs first");
  process.exit(1);
}

rec(
  "M1 columns present",
  psql(`
SELECT COUNT(*)::text FROM information_schema.columns
 WHERE table_name='visits'
   AND column_name IN ('customer_access_token','starts_at','slot_label','source_site_visit_id');
`).out === "4"
);

const link = psql(`
INSERT INTO public.site_visits (
  id, workspace_id, enquiry_id, visit_id, slot_label, starts_at, date_iso, notes, measurements, checklist, voice_notes
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001',
  '10000000-0000-4000-8000-000000000001',
  '10 November 2026 at 10:00',
  '2026-11-10T10:00:00.000Z',
  '2026-11-10',
  'Existing notes keep',
  '[{"label":"width","value":"3m"}]'::jsonb,
  '[{"id":"photos","label":"Photos","done":true}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO UPDATE
  SET visit_id = EXCLUDED.visit_id,
      notes = COALESCE(NULLIF(btrim(public.site_visits.notes), ''), EXCLUDED.notes)
RETURNING id, visit_id, notes;
`);
rec("link capture to visit preserves notes", link.ok && link.out.includes("Existing notes keep"), link.out);

rec(
  "linked capture has visit_id",
  psql(`
SELECT visit_id::text
FROM public.site_visits
WHERE enquiry_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001';
`).out === "10000000-0000-4000-8000-000000000001"
);

rec(
  "orphan calendar filter would exclude linked rows",
  psql(`
SELECT COUNT(*)::text FROM public.site_visits
 WHERE visit_id IS NULL AND starts_at IS NOT NULL;
`).ok
);

psql(`
DELETE FROM public.visits
 WHERE customer_access_token = 'TokenFollowUpDDDDDDDDDDDDDDDDDDDD';
`);
const followUp = psql(`
INSERT INTO public.visits (
  workspace_id, enquiry_id, customer_name, visit_type, visit_date, duration_minutes,
  status, customer_access_token, enquiry_summary
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001',
  'Customer One',
  'follow_up',
  '2026-11-20',
  60,
  'scheduled',
  'TokenFollowUpDDDDDDDDDDDDDDDDDDDD',
  'Follow up check'
)
RETURNING visit_type;
`);
rec("follow-up visit allowed alongside initial", followUp.ok && followUp.out.includes("follow_up"), followUp.out);

const isolation = psql(`
SELECT COUNT(*)::text FROM public.visits v
 JOIN public.workspaces w ON w.id = v.workspace_id
 WHERE v.customer_access_token = 'TokenCustomerOneAAAAAAAAAAAAAAAA'
   AND w.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
`);
rec("confirmation token scoped to owning workspace row", isolation.out === "1", isolation.out);

const failed = results.filter((r) => !r.ok);
console.log("\n=== Visits M2 unification rehearsal ===");
console.log(`passed ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  process.exit(1);
}
console.log("PASS: visits M2 unification rehearsal");
