import { describe, expect, it, vi, beforeEach } from "vitest";

const { getUserMock, fromMock, createClientMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const fromMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }));
  return { getUserMock, fromMock, createClientMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/admin/ensure-platform-admin-bootstrap", () => ({
  ensurePlatformAdminBootstrap: vi.fn(async () => ({ ok: true })),
}));

import {
  getPostAuthRedirectPath,
  resolvePostAuthPathForUser,
  userHasProfileForClient,
} from "@/lib/onboarding/status";

describe("onboarding status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    createClientMock.mockClear();
    delete process.env.PLATFORM_ADMIN_EMAILS;
  });

  it("treats a profiles row as setup complete", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "user-1" } }),
          }),
        }),
      })),
    };

    await expect(
      userHasProfileForClient(supabase as never, "user-1")
    ).resolves.toBe(true);
  });

  it("sends users with a profile to the dashboard after auth", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "user-1" } }),
          }),
        }),
      })),
    };

    await expect(
      resolvePostAuthPathForUser(supabase as never, {
        id: "user-1",
        email: "trader@example.com",
      } as never)
    ).resolves.toBe("/dashboard");
  });

  it("sends users without a profile to onboarding after auth", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      })),
    };

    await expect(
      resolvePostAuthPathForUser(supabase as never, {
        id: "user-1",
        email: "trader@example.com",
      } as never)
    ).resolves.toBe("/onboarding");
  });

  it("does not send a missing session to onboarding", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await expect(getPostAuthRedirectPath()).resolves.toBe("/login");
  });
});
