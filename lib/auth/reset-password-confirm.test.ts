import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtpMock, exchangeCodeMock } = vi.hoisted(() => {
  const verifyOtpMock = vi.fn();
  const exchangeCodeMock = vi.fn();
  return { verifyOtpMock, exchangeCodeMock };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      verifyOtp: verifyOtpMock,
      exchangeCodeForSession: exchangeCodeMock,
    },
  }),
}));

import { GET } from "@/app/auth/reset-password/confirm/route";

describe("/auth/reset-password/confirm", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    exchangeCodeMock.mockReset();
  });

  it("verifies recovery token_hash and redirects to reset-password", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest(
        "https://reanvil.com/auth/reset-password/confirm?token_hash=abc&type=recovery"
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

  it("maps expired recovery links to the expired error page", async () => {
    verifyOtpMock.mockResolvedValue({
      error: { message: "Email link is invalid or has expired" },
    });

    const response = await GET(
      new NextRequest(
        "https://reanvil.com/auth/reset-password/confirm?token_hash=old&type=recovery"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/auth/confirm/error?reason=expired"
    );
  });

  it("maps invalid recovery links to the invalid error page", async () => {
    verifyOtpMock.mockResolvedValue({
      error: { message: "Token has been used" },
    });

    const response = await GET(
      new NextRequest(
        "https://reanvil.com/auth/reset-password/confirm?token_hash=bad&type=recovery"
      )
    );

    expect(response.headers.get("location")).toContain(
      "/auth/confirm/error?reason=invalid"
    );
  });

  it("rejects missing token params", async () => {
    const response = await GET(
      new NextRequest("https://reanvil.com/auth/reset-password/confirm")
    );

    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain(
      "/auth/confirm/error?reason=missing"
    );
  });

  it("rejects non-recovery OTP types", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest(
        "https://reanvil.com/auth/reset-password/confirm?token_hash=abc&type=signup"
      )
    );

    expect(verifyOtpMock).toHaveBeenCalled();
    expect(response.headers.get("location")).toContain(
      "/auth/confirm/error?reason=invalid"
    );
  });
});
