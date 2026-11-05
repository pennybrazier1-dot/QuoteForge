import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  createClientMock,
  ensureBootstrapMock,
  redirectMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: { getUser: getUserMock },
  }));
  const ensureBootstrapMock = vi.fn();
  const redirectMock = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  return {
    getUserMock,
    createClientMock,
    ensureBootstrapMock,
    redirectMock,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/admin/ensure-platform-admin-bootstrap", () => ({
  ensurePlatformAdminBootstrap: ensureBootstrapMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { assertAdminAccess } from "@/lib/admin/assert-admin-access";

describe("assertAdminAccess (Stage 9K.2)", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalDevFlag = process.env.NEXT_PUBLIC_QF_DEV_TESTING;

  beforeEach(() => {
    getUserMock.mockReset();
    createClientMock.mockClear();
    ensureBootstrapMock.mockReset();
    redirectMock.mockClear();

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

  it("sends unauthenticated visitors to login", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(assertAdminAccess()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ensureBootstrapMock).not.toHaveBeenCalled();
  });

  it("rejects ordinary traders even when dev testing is enabled", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_QF_DEV_TESTING = "1";
    process.env.PLATFORM_ADMIN_EMAILS = "platform.admin.local@example.test";
    getUserMock.mockResolvedValue({
      data: { user: { id: "trader-1", email: "trader@example.com" } },
    });

    await expect(assertAdminAccess()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard"
    );
    expect(ensureBootstrapMock).not.toHaveBeenCalled();
  });

  it("rejects everyone when administrator allowlist is missing", async () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    process.env.NEXT_PUBLIC_QF_DEV_TESTING = "1";
    getUserMock.mockResolvedValue({
      data: { user: { id: "anyone-1", email: "anyone@example.com" } },
    });

    await expect(assertAdminAccess()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard"
    );
    expect(ensureBootstrapMock).not.toHaveBeenCalled();
  });

  it("allows explicitly allowlisted fictional administrators", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "platform.admin.local@example.test";
    process.env.VERCEL_ENV = "preview";
    const user = {
      id: "admin-1",
      email: "platform.admin.local@example.test",
    };
    getUserMock.mockResolvedValue({ data: { user } });
    ensureBootstrapMock.mockResolvedValue({ ok: true });

    await expect(assertAdminAccess()).resolves.toBeUndefined();
    expect(ensureBootstrapMock).toHaveBeenCalledWith(
      expect.anything(),
      user
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
