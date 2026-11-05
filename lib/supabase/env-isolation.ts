/**
 * Stage 9K.2 — refuse non-production runtimes that point at known Production
 * Supabase. Does not prove hosted preview is correctly configured; it only
 * blocks the known Production project ref when VERCEL_ENV/NODE_ENV indicate
 * preview or local development.
 */

/** Known Reanvil Production Supabase project ref (public identifier). */
export const REANVIL_PRODUCTION_SUPABASE_REF = "icqnivektneuxysqevqf";

export function supabaseUrlLooksLikeProduction(
  url: string | null | undefined
): boolean {
  const value = url?.trim() ?? "";
  if (!value) return false;
  return (
    value.includes(REANVIL_PRODUCTION_SUPABASE_REF) ||
    value.includes(`${REANVIL_PRODUCTION_SUPABASE_REF}.supabase.co`)
  );
}

/**
 * Preview and local development must not use Production Supabase credentials.
 * Production (VERCEL_ENV=production) is allowed to use the Production project.
 */
export function isNonProductionRuntime(options?: {
  vercelEnv?: string | undefined;
  nodeEnv?: string | undefined;
}): boolean {
  const vercelEnv = options?.vercelEnv ?? process.env.VERCEL_ENV;
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;

  if (vercelEnv === "production") {
    return false;
  }
  if (vercelEnv === "preview" || vercelEnv === "development") {
    return true;
  }
  // Local `next dev` / vitest typically have no VERCEL_ENV.
  return nodeEnv !== "production";
}

/**
 * Throws when a non-production runtime is configured with Production Supabase.
 * Safe to call before creating a service-role client.
 */
export function assertNonProductionSupabaseIsolation(
  url: string | null | undefined,
  options?: {
    vercelEnv?: string | undefined;
    nodeEnv?: string | undefined;
  }
): void {
  if (!isNonProductionRuntime(options)) {
    return;
  }
  if (!supabaseUrlLooksLikeProduction(url)) {
    return;
  }
  throw new Error(
    "Refusing privileged Supabase client: preview/local must not use Production Supabase credentials."
  );
}
