import { afterEach, describe, expect, it } from "vitest";
import { isPlatformAdmin } from "@/lib/admin/platform-admin";

describe("isPlatformAdmin", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
      process.env.PLATFORM_ADMIN_EMAILS = originalAllowlist;
    }
  });

  it("returns false when email is missing", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin("")).toBe(false);
  });

  it("returns false when allowlist is not configured", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;

    expect(isPlatformAdmin("owner@example.com")).toBe(false);
  });

  it("returns true for emails on the allowlist", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com, admin@example.com";

    expect(isPlatformAdmin("owner@example.com")).toBe(true);
    expect(isPlatformAdmin("Admin@Example.com")).toBe(true);
  });

  it("returns false for emails not on the allowlist", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    expect(isPlatformAdmin("trader@example.com")).toBe(false);
  });
});
