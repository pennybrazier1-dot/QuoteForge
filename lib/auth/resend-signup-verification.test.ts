import { describe, expect, it, vi } from "vitest";

const { resendMock, createClientMock } = vi.hoisted(() => {
  const resendMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: {
      resend: resendMock,
    },
  }));
  return { resendMock, createClientMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/env/site-url", () => ({
  getSiteUrl: () => "https://reanvil.com",
}));

import { resendSignupVerification } from "@/app/auth/actions";

describe("resendSignupVerification", () => {
  it("rejects empty email without calling Supabase", async () => {
    const result = await resendSignupVerification("   ");
    expect(result).toEqual({ ok: false, error: "Email is required." });
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("returns ok when Supabase resend succeeds", async () => {
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

  it("returns the Supabase error message on failure", async () => {
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
