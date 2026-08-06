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
});
