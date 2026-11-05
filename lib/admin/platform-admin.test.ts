import { afterEach, describe, expect, it } from "vitest";
import {
  getPlatformAdminAllowlist,
  isPlatformAdmin,
  isPlatformAdminAllowlisted,
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

describe("isPlatformAdmin (Stage 9K.2 fail-closed)", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;
  const originalVercelEnv = process.env.VERCEL_ENV;
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

    if (originalDevFlag === undefined) {
      delete process.env.NEXT_PUBLIC_QF_DEV_TESTING;
    } else {
      process.env.NEXT_PUBLIC_QF_DEV_TESTING = originalDevFlag;
    }
  });

  function useProductionSignals() {
    process.env.VERCEL_ENV = "production";
    delete process.env.NEXT_PUBLIC_QF_DEV_TESTING;
  }

  function usePreviewSignals() {
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_QF_DEV_TESTING = "1";
  }

  function useLocalDevSignals() {
    // Prefer VERCEL_ENV/development + public flag — avoid mutating read-only NODE_ENV.
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_QF_DEV_TESTING = "1";
  }

  it("returns false when email is missing", () => {
    useProductionSignals();
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin("")).toBe(false);
  });

  it("returns false when allowlist is not configured", () => {
    useProductionSignals();
    delete process.env.PLATFORM_ADMIN_EMAILS;

    expect(isPlatformAdmin("owner@example.com")).toBe(false);
    expect(getPlatformAdminAllowlist()).toEqual([]);
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

  it("never grants admin from local development flags alone", () => {
    useLocalDevSignals();
    delete process.env.PLATFORM_ADMIN_EMAILS;

    expect(isPlatformAdmin("anyone@example.com")).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it("never grants admin from preview / public flag alone", () => {
    usePreviewSignals();
    delete process.env.PLATFORM_ADMIN_EMAILS;

    expect(isPlatformAdmin("anyone@example.com")).toBe(false);
    expect(isPlatformAdmin("trader@example.com")).toBe(false);
  });

  it("still allows explicitly allowlisted fictional admins in local/preview", () => {
    useLocalDevSignals();
    process.env.PLATFORM_ADMIN_EMAILS = "platform.admin.local@example.test";

    expect(isPlatformAdmin("platform.admin.local@example.test")).toBe(true);
    expect(isPlatformAdmin("trader@example.com")).toBe(false);

    usePreviewSignals();
    process.env.PLATFORM_ADMIN_EMAILS = "platform.admin.local@example.test";
    expect(isPlatformAdmin("platform.admin.local@example.test")).toBe(true);
    expect(isPlatformAdmin("anyone@example.com")).toBe(false);
  });

  it("strips quotes from allowlist entries", () => {
    useProductionSignals();
    process.env.PLATFORM_ADMIN_EMAILS = '"owner@example.com"';

    expect(isPlatformAdmin("owner@example.com")).toBe(true);
  });

  it("isPlatformAdmin matches allowlist helper (no open-admin mode)", () => {
    useLocalDevSignals();
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    expect(isPlatformAdmin("anyone@example.com")).toBe(false);
    expect(isPlatformAdminAllowlisted("anyone@example.com")).toBe(false);
    expect(isPlatformAdmin("owner@example.com")).toBe(true);
    expect(isPlatformAdminAllowlisted("owner@example.com")).toBe(true);
  });
});
