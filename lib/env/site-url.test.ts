import { afterEach, describe, expect, it } from "vitest";
import {
  PRODUCTION_SITE_URL,
  getSiteUrl,
  normalizeSiteUrl,
} from "@/lib/env/site-url";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalVercelUrl = process.env.VERCEL_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
  if (originalVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = originalVercelUrl;
  }
});

describe("normalizeSiteUrl", () => {
  it("maps production aliases to www.reanvil.com", () => {
    expect(normalizeSiteUrl("https://reanvil.com")).toBe(PRODUCTION_SITE_URL);
    expect(normalizeSiteUrl("https://www.reanvil.com/")).toBe(
      PRODUCTION_SITE_URL
    );
    expect(normalizeSiteUrl("https://app.reanvil.com")).toBe(
      PRODUCTION_SITE_URL
    );
    expect(normalizeSiteUrl("app.reanvil.com")).toBe(PRODUCTION_SITE_URL);
  });

  it("leaves non-production hosts unchanged aside from trailing slash", () => {
    expect(normalizeSiteUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeSiteUrl("http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
  });
});

describe("getSiteUrl", () => {
  it("normalizes NEXT_PUBLIC_SITE_URL production aliases", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.reanvil.com";
    delete process.env.VERCEL_URL;
    expect(getSiteUrl()).toBe(PRODUCTION_SITE_URL);
  });

  it("falls back to localhost when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
