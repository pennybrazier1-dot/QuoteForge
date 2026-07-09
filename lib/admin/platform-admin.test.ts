import { afterEach, describe, expect, it } from "vitest";
import {
  isPlatformAdmin,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";

describe("resolveAuthEmail", () => {
  it("uses auth email when present", () => {
    expect(resolveAuthEmail({ email: "owner@example.com" })).toBe(
      "owner@example.com"
    );
  });

  it("falls back to user_metadata email", () => {
    expect(
      resolveAuthEmail({
        email: null,
        user_metadata: { email: "meta@example.com" },
      })
    ).toBe("meta@example.com");
  });
});

describe("isPlatformAdmin", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevFlag = process.env.NEXT_PUBLIC_QF_DEV_TESTING;

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
      process.env.PLATFORM_ADMIN_EMAILS = originalAllowlist;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalDevFlag === undefined) {
      delete process.env.NEXT_PUBLIC_QF_DEV_TESTING;
    } else {
      process.env.NEXT_PUBLIC_QF_DEV_TESTING = originalDevFlag;
    }
  });

  function useProductionSignals() {
    process.env.VERCEL_ENV = "production";
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_QF_DEV_TESTING;
  }

  it("returns false when email is missing in production", () => {
    useProductionSignals();
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin("")).toBe(false);
  });

  it("returns false when allowlist is not configured in production", () => {
    useProductionSignals();
    delete process.env.PLATFORM_ADMIN_EMAILS;

    expect(isPlatformAdmin("owner@example.com")).toBe(false);
  });

  it("returns true for emails on the allowlist in production", () => {
    useProductionSignals();
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com, admin@example.com";

    expect(isPlatformAdmin("owner@example.com")).toBe(true);
    expect(isPlatformAdmin("Admin@Example.com")).toBe(true);
  });

  it("returns false for emails not on the allowlist in production", () => {
    useProductionSignals();
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    expect(isPlatformAdmin("trader@example.com")).toBe(false);
  });

  it("allows admin access in local development even without allowlist", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;

    expect(isPlatformAdmin("anyone@example.com")).toBe(true);
    expect(isPlatformAdmin(null)).toBe(true);
  });

  it("strips quotes from allowlist entries", () => {
    useProductionSignals();
    process.env.PLATFORM_ADMIN_EMAILS = '"owner@example.com"';

    expect(isPlatformAdmin("owner@example.com")).toBe(true);
  });
});
