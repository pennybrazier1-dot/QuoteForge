import { afterEach, describe, expect, it, vi } from "vitest";

const { getUserMock, createClientMock, redirectMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const createClientMock = vi.fn(async () => ({
    auth: { getUser: getUserMock },
  }));
  const redirectMock = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  return { getUserMock, createClientMock, redirectMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { assertCustomerJourneyDemoAccess } from "@/lib/customer-journey/assert-demo-access";

describe("assertCustomerJourneyDemoAccess", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalDevFlag = process.env.NEXT_PUBLIC_QF_DEV_TESTING;

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
      process.env.PLATFORM_ADMIN_EMAILS = originalAllowlist;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }

    if (originalDevFlag === undefined) {
      delete process.env.NEXT_PUBLIC_QF_DEV_TESTING;
    } else {
      process.env.NEXT_PUBLIC_QF_DEV_TESTING = originalDevFlag;
    }

    getUserMock.mockReset();
    createClientMock.mockClear();
    redirectMock.mockClear();
  });

  it("allows access in non-production testing mode without signing in", async () => {
    process.env.VERCEL_ENV = "preview";
    await expect(assertCustomerJourneyDemoAccess()).resolves.toBeUndefined();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("allows allowlisted platform admins in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-1", email: "owner@example.com" } },
    });

    await expect(assertCustomerJourneyDemoAccess()).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("blocks production visitors who are not platform admins", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
    getUserMock.mockResolvedValue({
      data: { user: { id: "trader-1", email: "trader@example.com" } },
    });

    await expect(assertCustomerJourneyDemoAccess()).rejects.toThrow(
      "NEXT_REDIRECT:/"
    );
  });
});
