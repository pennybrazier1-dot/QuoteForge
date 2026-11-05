import { describe, expect, it } from "vitest";
import {
  REANVIL_PRODUCTION_SUPABASE_REF,
  assertNonProductionSupabaseIsolation,
  isNonProductionRuntime,
  supabaseUrlLooksLikeProduction,
} from "@/lib/supabase/env-isolation";

describe("Supabase env isolation (Stage 9K.2)", () => {
  it("detects the known Production Supabase project ref", () => {
    expect(
      supabaseUrlLooksLikeProduction(
        `https://${REANVIL_PRODUCTION_SUPABASE_REF}.supabase.co`
      )
    ).toBe(true);
    expect(supabaseUrlLooksLikeProduction("http://127.0.0.1:54321")).toBe(
      false
    );
  });

  it("treats preview and local development as non-production runtimes", () => {
    expect(
      isNonProductionRuntime({ vercelEnv: "preview", nodeEnv: "production" })
    ).toBe(true);
    expect(
      isNonProductionRuntime({
        vercelEnv: undefined,
        nodeEnv: "development",
      })
    ).toBe(true);
    expect(
      isNonProductionRuntime({ vercelEnv: "production", nodeEnv: "production" })
    ).toBe(false);
  });

  it("refuses preview/local when URL points at Production", () => {
    expect(() =>
      assertNonProductionSupabaseIsolation(
        `https://${REANVIL_PRODUCTION_SUPABASE_REF}.supabase.co`,
        { vercelEnv: "preview", nodeEnv: "production" }
      )
    ).toThrow(/must not use Production Supabase/i);

    expect(() =>
      assertNonProductionSupabaseIsolation(
        `https://${REANVIL_PRODUCTION_SUPABASE_REF}.supabase.co`,
        { vercelEnv: undefined, nodeEnv: "development" }
      )
    ).toThrow(/must not use Production Supabase/i);
  });

  it("allows Production runtime to use Production Supabase URL", () => {
    expect(() =>
      assertNonProductionSupabaseIsolation(
        `https://${REANVIL_PRODUCTION_SUPABASE_REF}.supabase.co`,
        { vercelEnv: "production", nodeEnv: "production" }
      )
    ).not.toThrow();
  });

  it("allows local URL in local/preview runtimes", () => {
    expect(() =>
      assertNonProductionSupabaseIsolation("http://127.0.0.1:54321", {
        vercelEnv: "preview",
        nodeEnv: "production",
      })
    ).not.toThrow();
  });
});
