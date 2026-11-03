import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveVisitStartsAt } from "@/lib/visits/customer-confirmation/starts-at";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("unified visits milestone 6A corrections", () => {
  it("books only after capture linking succeeds and rolls back empty visits on failure", () => {
    const actions = readRepo("lib/visits/actions.ts");
    const createBlock = actions.slice(
      actions.indexOf("export async function createVisitAction"),
      actions.indexOf("export async function updateVisitNotesAction")
    );
    expect(createBlock).toContain("linkCaptureSessionToVisit");
    expect(createBlock.indexOf("linkCaptureSessionToVisit")).toBeLessThan(
      createBlock.indexOf("status: \"site_visit_booked\"")
    );
    expect(createBlock).toContain(".delete()");
    expect(createBlock).toContain("The visit was not booked");
    expect(createBlock).toContain("resolveVisitStartsAt");
  });

  it("applies the same London validation on reschedule", () => {
    const actions = readRepo("lib/visits/actions.ts");
    const reschedule = actions.slice(
      actions.indexOf("export async function rescheduleVisitAction"),
      actions.indexOf("export async function cancelVisitAction")
    );
    expect(reschedule).toContain("resolveVisitStartsAt");
    expect(reschedule).toContain("startsAtResolved.error");
  });

  it("locks historical review to service/server roles", () => {
    const migration = readRepo(
      "supabase/migrations/20261104030000_site_visits_capture_per_visit.sql"
    );
    expect(migration).toContain("force row level security");
    expect(migration).toContain("from anon");
    expect(migration).toContain("from authenticated");
    expect(migration).toContain("to service_role");
  });

  it("rejects invalid UK DST appointment times in the shared resolver", () => {
    expect(resolveVisitStartsAt("2026-03-29", "01:30").ok).toBe(false);
    expect(resolveVisitStartsAt("2026-10-25", "01:30").ok).toBe(false);
    expect(resolveVisitStartsAt("2026-11-20", "10:00")).toEqual({
      ok: true,
      startsAt: "2026-11-20T10:00:00.000Z",
    });
  });
});
