import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const { createServiceRoleClientMock } = vi.hoisted(() => ({
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { ensurePlatformAdminBootstrap } from "@/lib/admin/ensure-platform-admin-bootstrap";
import { resolvePostAuthPathForUser } from "@/lib/onboarding/status";

function asUser(partial: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): User {
  return partial as unknown as User;
}

function makeFromMock(options: {
  profileExists?: boolean;
  existingWorkspaceId?: string | null;
  insertWorkspaceError?: string | null;
  insertProfileError?: string | null;
}) {
  const {
    profileExists = false,
    existingWorkspaceId = null,
    insertWorkspaceError = null,
    insertProfileError = null,
  } = options;

  return (table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: profileExists ? { id: "user-1" } : null,
            }),
          }),
        }),
        insert: async () => {
          if (insertProfileError) {
            return { error: { message: insertProfileError } };
          }
          return { error: null };
        },
      };
    }

    if (table === "workspaces") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: existingWorkspaceId
                ? { id: existingWorkspaceId }
                : null,
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => {
              if (insertWorkspaceError) {
                return {
                  data: null,
                  error: { message: insertWorkspaceError },
                };
              }
              return { data: { id: "workspace-1" }, error: null };
            },
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  };
}

describe("platform admin bootstrap", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
      process.env.PLATFORM_ADMIN_EMAILS = originalAllowlist;
    }
    createServiceRoleClientMock.mockReset();
  });

  it("skips bootstrap for emails not on the allowlist", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    createServiceRoleClientMock.mockImplementation(() => {
      throw new Error("should not run");
    });
    const supabase = { from: vi.fn() } as never;
    const user = asUser({ id: "user-1", email: "trader@example.com" });

    const result = await ensurePlatformAdminBootstrap(supabase, user);
    expect(result).toEqual({
      ok: false,
      error: "Not on PLATFORM_ADMIN_EMAILS.",
    });
    expect(
      (supabase as { from: ReturnType<typeof vi.fn> }).from
    ).not.toHaveBeenCalled();
  });

  it("creates workspace and profile via service role for allowlisted admins", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    const from = makeFromMock({ profileExists: false });
    createServiceRoleClientMock.mockReturnValue({ from });

    const sessionClient = { from: vi.fn() } as never;
    const user = asUser({
      id: "user-1",
      email: "owner@example.com",
      user_metadata: { full_name: "Penny Admin" },
    });

    const result = await ensurePlatformAdminBootstrap(sessionClient, user);
    expect(result).toEqual({ ok: true });
    expect(createServiceRoleClientMock).toHaveBeenCalled();
    expect(
      (sessionClient as { from: ReturnType<typeof vi.fn> }).from
    ).not.toHaveBeenCalled();
  });

  it("always resolves allowlisted admins to /admin (never onboarding)", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    const from = makeFromMock({ profileExists: false });
    createServiceRoleClientMock.mockReturnValue({ from });

    const path = await resolvePostAuthPathForUser(
      { from: vi.fn() } as never,
      asUser({ id: "user-1", email: "owner@example.com" })
    );

    expect(path).toBe("/admin");
  });

  it("still resolves allowlisted admins to /admin if bootstrap insert fails", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    createServiceRoleClientMock.mockReturnValue({
      from: makeFromMock({
        profileExists: false,
        insertWorkspaceError: "boom",
      }),
    });

    const path = await resolvePostAuthPathForUser(
      { from: vi.fn() } as never,
      asUser({ id: "user-1", email: "owner@example.com" })
    );

    expect(path).toBe("/admin");
  });

  it("resolves regular users without a profile to /onboarding", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    createServiceRoleClientMock.mockImplementation(() => {
      throw new Error("unused");
    });

    const path = await resolvePostAuthPathForUser(
      { from: makeFromMock({ profileExists: false }) } as never,
      asUser({ id: "user-2", email: "trader@example.com" })
    );

    expect(path).toBe("/onboarding");
  });
});
