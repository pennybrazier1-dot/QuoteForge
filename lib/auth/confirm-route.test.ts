import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyOtpMock,
  exchangeCodeMock,
  getUserMock,
  fromMock,
  createClientMock,
} = vi.hoisted(() => {
  const verifyOtpMock = vi.fn();
  const exchangeCodeMock = vi.fn();
  const getUserMock = vi.fn();
  const fromMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: {
      verifyOtp: verifyOtpMock,
      exchangeCodeForSession: exchangeCodeMock,
      getUser: getUserMock,
    },
    from: fromMock,
  }));
  return {
    verifyOtpMock,
    exchangeCodeMock,
    getUserMock,
    fromMock,
    createClientMock,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
  }),
}));

import { GET } from "@/app/auth/confirm/route";

describe("/auth/confirm", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    exchangeCodeMock.mockReset();
    getUserMock.mockReset();
    fromMock.mockReset();
    createClientMock.mockClear();

    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    });
  });

  it("verifies a valid token_hash and redirects into onboarding", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const response = await GET(
      new NextRequest(
        "https://reanvil.com/auth/confirm?token_hash=abc&type=signup"
      )
    );

    expect(verifyOtpMock).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "abc",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://reanvil.com/onboarding"
    );
  });

  it("shows an expired error for expired confirmation links", async () => {
    verifyOtpMock.mockResolvedValue({
      error: { message: "Email link is invalid or has expired" },
    });

    const response = await GET(
      new NextRequest(
        "https://reanvil.com/auth/confirm?token_hash=old&type=signup"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/auth/confirm/error?reason=expired"
    );
  });

  it("rejects missing token params", async () => {
    const response = await GET(
      new NextRequest("https://reanvil.com/auth/confirm")
    );

    expect(response.headers.get("location")).toContain(
      "/auth/confirm/error?reason=missing"
    );
  });

  it("redirects recovery confirmations to the reset-password page", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const response = await GET(
      new NextRequest(
        "https://reanvil.com/auth/confirm?token_hash=abc&type=recovery"
      )
    );

    expect(verifyOtpMock).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "abc",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://reanvil.com/auth/reset-password"
    );
  });

  it("redirects allowlisted platform admins to /admin after confirm", async () => {
    const original = process.env.PLATFORM_ADMIN_EMAILS;
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    verifyOtpMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "admin-1",
          email: "owner@example.com",
          user_metadata: { full_name: "Owner" },
        },
      },
    });

    // No profile yet → bootstrap inserts workspace + profile
    let profileLookups = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                profileLookups += 1;
                return { data: null };
              },
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === "workspaces") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "workspace-admin" },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    try {
      const response = await GET(
        new NextRequest(
          "https://reanvil.com/auth/confirm?token_hash=abc&type=signup"
        )
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://reanvil.com/admin");
      expect(profileLookups).toBeGreaterThan(0);
    } finally {
      if (original === undefined) {
        delete process.env.PLATFORM_ADMIN_EMAILS;
      } else {
        process.env.PLATFORM_ADMIN_EMAILS = original;
      }
    }
  });
});
