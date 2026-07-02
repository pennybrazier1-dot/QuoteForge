import { describe, expect, it } from "vitest";
import {
  isDevTestingEnabled,
  isDevTestingEnabledClient,
} from "@/lib/env/dev-testing";

describe("isDevTestingEnabled", () => {
  it("is disabled on Vercel production", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";

    expect(isDevTestingEnabled()).toBe(false);

    process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("is enabled on Vercel preview", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";

    expect(isDevTestingEnabled()).toBe(true);

    process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("is enabled when NODE_ENV is development", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "development";

    expect(isDevTestingEnabled()).toBe(true);

    process.env.VERCEL_ENV = originalVercelEnv;
    process.env.NODE_ENV = originalNodeEnv;
  });
});

describe("isDevTestingEnabledClient", () => {
  it("is enabled when NEXT_PUBLIC_VERCEL_ENV is preview", () => {
    const originalPublicVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";

    expect(isDevTestingEnabledClient()).toBe(true);

    process.env.NEXT_PUBLIC_VERCEL_ENV = originalPublicVercelEnv;
  });

  it("is disabled when NEXT_PUBLIC_VERCEL_ENV is production", () => {
    const originalPublicVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";

    expect(isDevTestingEnabledClient()).toBe(false);

    process.env.NEXT_PUBLIC_VERCEL_ENV = originalPublicVercelEnv;
  });
});
