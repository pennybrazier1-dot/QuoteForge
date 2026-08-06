import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  fromMock,
  createClientMock,
  ensureBootstrapMock,
  userHasProfileMock,
  redirectMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const fromMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }));
  const ensureBootstrapMock = vi.fn();
  const userHasProfileMock = vi.fn();
  const redirectMock = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  return {
    getUserMock,
    fromMock,
    createClientMock,
    ensureBootstrapMock,
    userHasProfileMock,
    redirectMock,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/admin/ensure-platform-admin-bootstrap", () => ({
  ensurePlatformAdminBootstrap: ensureBootstrapMock,
}));

vi.mock("@/lib/onboarding/status", () => ({
  userHasProfile: userHasProfileMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { loadAppShellContext } from "@/lib/layout/load-app-shell";

describe("loadAppShellContext", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;

  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    createClientMock.mockClear();
    ensureBootstrapMock.mockReset();
    userHasProfileMock.mockReset();
    redirectMock.mockClear();

    if (originalAllowlist === undefined) {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
      process.env.PLATFORM_ADMIN_EMAILS = originalAllowlist;
    }

    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { full_name: "Penny Admin" },
              }),
            }),
          }),
        };
      }
      if (table === "proposals") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [] }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("bootstraps allowlisted admins then loads the trader shell", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-1", email: "owner@example.com" } },
    });
    ensureBootstrapMock.mockResolvedValue({ ok: true });
    userHasProfileMock.mockResolvedValue(true);

    const result = await loadAppShellContext();

    expect(ensureBootstrapMock).toHaveBeenCalled();
    expect(result.viewingTraderAsAdmin).toBe(true);
    expect(result.fullName).toBe("Penny Admin");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not bootstrap normal traders and still requires a profile", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    getUserMock.mockResolvedValue({
      data: { user: { id: "trader-1", email: "trader@example.com" } },
    });
    userHasProfileMock.mockResolvedValue(false);

    await expect(loadAppShellContext()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding"
    );
    expect(ensureBootstrapMock).not.toHaveBeenCalled();
  });

  it("sends allowlisted admins to /admin if bootstrap cannot create a profile", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-1", email: "owner@example.com" } },
    });
    ensureBootstrapMock.mockResolvedValue({ ok: false, error: "boom" });
    userHasProfileMock.mockResolvedValue(false);

    await expect(loadAppShellContext()).rejects.toThrow(
      "NEXT_REDIRECT:/admin"
    );
    expect(ensureBootstrapMock).toHaveBeenCalled();
  });
});
