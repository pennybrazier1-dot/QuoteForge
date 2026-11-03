import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("visits milestone 3A historical backfill", () => {
  const migration = readRepo(
    "supabase/migrations/20261104020000_visits_historical_backfill.sql"
  );

  it("is additive and does not drop historical tables", () => {
    expect(migration).toContain("visits_unification_backfill_log");
    expect(migration).toContain("create_visit_from_capture");
    expect(migration).toContain("skip_ambiguous_multiple_visits");
    expect(migration).toContain("skip_no_date");
    expect(migration).not.toMatch(/drop table\s+public\.visits/i);
    expect(migration).not.toMatch(/drop table\s+public\.site_visits/i);
    expect(migration).not.toMatch(/delete from\s+public\.site_visits/i);
    expect(migration).not.toMatch(/delete from\s+public\.visits/i);
  });

  it("never overwrites capture notes or media", () => {
    expect(migration).not.toMatch(/update\s+public\.site_visits[\s\S]{0,200}notes\s*=/i);
    expect(migration).not.toMatch(/update\s+public\.enquiry_media/i);
    expect(migration).toContain("Never overwrites capture notes/photos");
  });

  it("mints tokens only when missing and does not rotate existing ones", () => {
    expect(migration).toContain("customer_access_token is null");
    expect(migration).toContain("reanvil_visit_confirmation_token");
    expect(migration).toContain("mint_token");
  });

  it("locks the backfill audit log to service/server roles", () => {
    expect(migration).toContain("force row level security");
    expect(migration).toContain(
      "revoke all on table public.visits_unification_backfill_log from anon"
    );
    expect(migration).toContain(
      "revoke all on table public.visits_unification_backfill_log from authenticated"
    );
    expect(migration).toContain(
      "grant all on table public.visits_unification_backfill_log to service_role"
    );
    expect(migration).toContain(
      'drop policy if exists "workspace members can read backfill log"'
    );
    expect(migration).not.toMatch(
      /create policy\s+"workspace members can read backfill log"/i
    );
  });

  it("keeps Stage 2 and job scheduling files untouched by this milestone", () => {
    expect(
      readRepo("lib/proposals/revision/accept-at-revision.ts")
    ).not.toContain("visits_unification_backfill");
    expect(
      readRepo("lib/proposals/schedule/confirm-schedule-action.ts")
    ).not.toContain("visits_unification_backfill");
  });

  it("provides read-only production diagnostics for later approval", () => {
    const diagnostics = readRepo("scripts/visits-m3a-production-diagnostics.sql");
    expect(diagnostics).toContain("READ-ONLY");
    expect(diagnostics).not.toMatch(/\b(update|insert|delete|drop)\b/i);
  });
});
