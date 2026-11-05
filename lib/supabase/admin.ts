import { createClient } from "@supabase/supabase-js";
import { assertNonProductionSupabaseIsolation } from "@/lib/supabase/env-isolation";

/**
 * Service-role client for privileged admin operations.
 * Never import this into client components.
 *
 * Stage 9K.2: refuses to construct when preview/local points at known
 * Production Supabase. Does not read or log the service-role secret.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured for admin operations."
    );
  }

  assertNonProductionSupabaseIsolation(url);

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local / Vercel to run admin user deletion."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
