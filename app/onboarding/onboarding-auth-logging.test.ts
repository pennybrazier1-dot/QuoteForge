import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readOnboardingPage(): string {
  return readFileSync(join(process.cwd(), "app/onboarding/page.tsx"), "utf8");
}

describe("Stage 9L.2A — onboarding auth logging hygiene", () => {
  it("does not log authentication email or auth-admin debug payloads", () => {
    const source = readOnboardingPage();
    expect(source).not.toContain("auth-admin-debug");
    expect(source).not.toContain("TEMPORARY AUTH DEBUG");
    expect(source).not.toContain("resolvedAuthEmail");
    expect(source).not.toMatch(/console\.(info|log|debug)\(/);
  });

  it("still routes allowlisted admins before the trader onboarding form", () => {
    const source = readOnboardingPage();
    expect(source).toContain("isPlatformAdminAllowlisted");
    expect(source).toContain("ensurePlatformAdminBootstrap");
    expect(source).toContain('redirect("/admin")');
    expect(source).toContain("resolvePostAuthPathForUser");
    expect(source).toContain("OnboardingForm");
  });
});
