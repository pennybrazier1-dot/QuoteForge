import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  rpcMock,
  createClientMock,
  createServiceRoleClientMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const rpcMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: { getUser: getUserMock },
  }));
  const createServiceRoleClientMock = vi.fn(() => ({
    rpc: rpcMock,
  }));
  return {
    getUserMock,
    rpcMock,
    createClientMock,
    createServiceRoleClientMock,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

vi.mock("@/lib/admin/platform-admin", () => ({
  isPlatformAdmin: (email: string | null | undefined) =>
    email === "admin@reanvil.com",
  resolveAuthEmail: (user: { email?: string | null }) => user.email ?? null,
}));

import { adminDeleteUser } from "@/app/admin/actions";

describe("adminDeleteUser action", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    createClientMock.mockClear();
    createServiceRoleClientMock.mockClear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  it("blocks non-admins", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-1", email: "trader@example.com" } },
    });

    const result = await adminDeleteUser({
      userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      confirmEmail: "test@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("platform admins");
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("blocks deleting the signed-in admin", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
          email: "admin@reanvil.com",
        },
      },
    });

    const result = await adminDeleteUser({
      userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      confirmEmail: "admin@reanvil.com",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SELF_DELETE_BLOCKED",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the transactional RPC for admins", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-1", email: "admin@reanvil.com" } },
    });
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        email: "test@example.com",
        deletedWorkspaces: 1,
        deletedStorageObjects: 0,
      },
      error: null,
    });

    const result = await adminDeleteUser({
      userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      confirmEmail: "test@example.com",
    });

    expect(rpcMock).toHaveBeenCalledWith("admin_delete_user", {
      target_user_id: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      confirm_email: "test@example.com",
    });
    expect(result).toEqual({
      ok: true,
      userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      email: "test@example.com",
      deletedWorkspaces: 1,
      deletedStorageObjects: 0,
    });
  });

  it("maps RPC failures to clear errors", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-1", email: "admin@reanvil.com" } },
    });
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message:
          "USER_NOT_FOUND: No auth user exists with id 3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b.",
      },
    });

    const result = await adminDeleteUser({
      userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      confirmEmail: "missing@example.com",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "USER_NOT_FOUND",
    });
  });
});
