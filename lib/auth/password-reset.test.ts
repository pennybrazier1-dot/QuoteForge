import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resetPasswordForEmailMock,
  updateUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => {
  const resetPasswordForEmailMock = vi.fn();
  const updateUserMock = vi.fn();
  const getUserMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: {
      resetPasswordForEmail: resetPasswordForEmailMock,
      updateUser: updateUserMock,
      getUser: getUserMock,
    },
  }));
  return {
    resetPasswordForEmailMock,
    updateUserMock,
    getUserMock,
    createClientMock,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/env/site-url", () => ({
  getSiteUrl: () => "https://reanvil.com",
}));

vi.mock("@/lib/onboarding/status", () => ({
  getPostAuthRedirectPath: async () => "/dashboard",
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

import {
  requestPasswordReset,
  updatePassword,
} from "@/app/auth/actions";

describe("password reset actions", () => {
  beforeEach(() => {
    resetPasswordForEmailMock.mockReset();
    updateUserMock.mockReset();
    getUserMock.mockReset();
    createClientMock.mockClear();
  });

  it("requests a reset email with the reset-password redirect", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", "alex@example.com");

    const result = await requestPasswordReset({}, formData);

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      "alex@example.com",
      { redirectTo: "https://reanvil.com/auth/reset-password" }
    );
    expect(result.success).toMatch(/password reset link/i);
    expect(result.error).toBeUndefined();
  });

  it("requires email for reset requests", async () => {
    const formData = new FormData();
    const result = await requestPasswordReset({}, formData);
    expect(result.error).toMatch(/email/i);
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("updates the password when a recovery session exists", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    updateUserMock.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("password", "newpassword1");
    formData.set("confirmPassword", "newpassword1");

    await expect(updatePassword({}, formData)).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard"
    );
    expect(updateUserMock).toHaveBeenCalledWith({ password: "newpassword1" });
  });

  it("rejects mismatched passwords", async () => {
    const formData = new FormData();
    formData.set("password", "newpassword1");
    formData.set("confirmPassword", "different");

    const result = await updatePassword({}, formData);
    expect(result.error).toMatch(/match/i);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("blocks password update without a session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const formData = new FormData();
    formData.set("password", "newpassword1");
    formData.set("confirmPassword", "newpassword1");

    const result = await updatePassword({}, formData);
    expect(result.error).toMatch(/expired|missing/i);
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
