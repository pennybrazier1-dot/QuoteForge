import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUpMock, resendMock, createClientMock, redirectMock } = vi.hoisted(
  () => {
    const signUpMock = vi.fn();
    const resendMock = vi.fn();
    const createClientMock = vi.fn(async () => ({
      auth: {
        signUp: signUpMock,
        resend: resendMock,
      },
    }));
    const redirectMock = vi.fn((path: string) => {
      const error = new Error(`NEXT_REDIRECT:${path}`);
      // Mimic next/navigation redirect control flow.
      throw error;
    });
    return { signUpMock, resendMock, createClientMock, redirectMock };
  }
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/env/site-url", () => ({
  getSiteUrl: () => "https://reanvil.com",
}));

vi.mock("@/lib/onboarding/status", () => ({
  getPostAuthRedirectPath: vi.fn(async () => "/onboarding"),
}));

import {
  resendSignupVerification,
  signup,
} from "@/app/auth/actions";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("signup verification flow", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    resendMock.mockReset();
    redirectMock.mockClear();
    createClientMock.mockClear();
  });

  it("returns a clear error and stays on signup when Supabase fails", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Password should be at least 8 characters." },
    });

    const result = await signup(
      {},
      form({
        fullName: "Alex Trader",
        email: "alex@example.com",
        password: "short",
      })
    );

    expect(result).toEqual({
      error: "Password must be at least 8 characters.",
    });
    expect(signUpMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("shows the real Supabase error on failed signUp", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Unable to validate email address: invalid format" },
    });

    const result = await signup(
      {},
      form({
        fullName: "Alex Trader",
        email: "not-an-email",
        password: "password123",
      })
    );

    expect(result).toEqual({
      error: "Unable to validate email address: invalid format",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /check-email when signup succeeds without a session", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-1", identities: [{ id: "ident-1" }] },
        session: null,
      },
      error: null,
    });

    await expect(
      signup(
        {},
        form({
          fullName: "Alex Trader",
          email: "alex@example.com",
          password: "password123",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/check-email?email=alex%40example.com");

    expect(signUpMock).toHaveBeenCalledWith({
      email: "alex@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "https://reanvil.com/auth/confirm",
        data: { full_name: "Alex Trader" },
      },
    });
  });

  it("does not send users to /login immediately after signup", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-1", identities: [{ id: "ident-1" }] },
        session: null,
      },
      error: null,
    });

    await expect(
      signup(
        {},
        form({
          fullName: "Alex Trader",
          email: "alex@example.com",
          password: "password123",
        })
      )
    ).rejects.toThrow(/check-email/);

    const redirectPath = String(redirectMock.mock.calls[0]?.[0] ?? "");
    expect(redirectPath.startsWith("/login")).toBe(false);
  });

  it("resends signup verification to /auth/confirm", async () => {
    resendMock.mockResolvedValue({ error: null });

    const result = await resendSignupVerification("alex@example.com");

    expect(result).toEqual({ ok: true });
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "alex@example.com",
      options: {
        emailRedirectTo: "https://reanvil.com/auth/confirm",
      },
    });
  });

  it("returns Supabase resend errors", async () => {
    resendMock.mockResolvedValue({
      error: {
        message:
          "For security purposes, you can only request this after 60 seconds.",
      },
    });

    const result = await resendSignupVerification("alex@example.com");
    expect(result).toEqual({
      ok: false,
      error:
        "For security purposes, you can only request this after 60 seconds.",
    });
  });
});
