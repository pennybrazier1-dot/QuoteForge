import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Stage 9K.2 administrator security wiring", () => {
  it("isPlatformAdmin no longer trusts isDevTestingEnabled", () => {
    const source = readRepo("lib/admin/platform-admin.ts");
    expect(source).not.toContain("isDevTestingEnabled");
    expect(source).toContain("fail-closed");
    expect(source).toContain(
      "return isPlatformAdminAllowlisted(email)"
    );
  });

  it("admin layout and destructive actions enforce server-side checks", () => {
    const layout = readRepo("app/admin/layout.tsx");
    const actions = readRepo("app/admin/actions.ts");
    const assertAccess = readRepo("lib/admin/assert-admin-access.ts");
    const loadUsers = readRepo("lib/admin/load-test-users.ts");

    expect(layout).toContain("assertAdminAccess");
    expect(assertAccess).toContain("isPlatformAdmin");
    expect(assertAccess).toContain('redirect("/login")');
    expect(assertAccess).toContain('redirect("/dashboard")');
    expect(actions).toContain("isPlatformAdmin");
    expect(actions).toContain("getUser");
    expect(loadUsers).toContain("isPlatformAdmin");
  });

  it("service-role client applies non-production isolation guard", () => {
    const admin = readRepo("lib/supabase/admin.ts");
    expect(admin).toContain("assertNonProductionSupabaseIsolation");
  });

  it("middleware still only auto-routes allowlisted admins to /admin", () => {
    const middleware = readRepo("lib/supabase/middleware.ts");
    expect(middleware).toContain("isPlatformAdminAllowlisted");
    expect(middleware).not.toContain("isPlatformAdmin(");
  });
});
