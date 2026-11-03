import { describe, expect, it } from "vitest";
import {
  isLocalSupabaseHost,
  outboundEmailBlockReason,
} from "@/lib/email/outbound-guard";

describe("outbound email guard (local isolation)", () => {
  it("detects local Supabase hosts", () => {
    expect(isLocalSupabaseHost("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseHost("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseHost("https://abc.supabase.co")).toBe(false);
  });

  it("blocks outbound when pointed at local Supabase unless overridden", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAllow = process.env.REANVIL_ALLOW_LOCAL_OUTBOUND;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
      delete process.env.REANVIL_ALLOW_LOCAL_OUTBOUND;
      expect(outboundEmailBlockReason()).toMatch(/blocked for local/i);

      process.env.REANVIL_ALLOW_LOCAL_OUTBOUND = "1";
      expect(outboundEmailBlockReason()).toBeNull();
    } finally {
      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      }
      if (previousAllow === undefined) {
        delete process.env.REANVIL_ALLOW_LOCAL_OUTBOUND;
      } else {
        process.env.REANVIL_ALLOW_LOCAL_OUTBOUND = previousAllow;
      }
    }
  });
});
