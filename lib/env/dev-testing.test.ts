import { describe, expect, it } from "vitest";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

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
});
