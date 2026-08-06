import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import {
  mapVerifyOtpError,
  parseConfirmLinkParams,
} from "@/lib/auth/confirm-link";

export type EstablishSessionResult =
  | { ok: true; type: EmailOtpType | "code" | null }
  | { ok: false; reason: "expired" | "invalid" | "missing" };

/**
 * Establishes an auth session from email-link query params
 * (token_hash + type, or PKCE code).
 */
export async function establishSessionFromLinkParams(
  supabase: SupabaseClient,
  searchParams: URLSearchParams
): Promise<EstablishSessionResult> {
  const params = parseConfirmLinkParams(searchParams);

  if (params.tokenHash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      type: params.type,
      token_hash: params.tokenHash,
    });

    if (error) {
      return { ok: false, reason: mapVerifyOtpError(error.message) };
    }

    return { ok: true, type: params.type };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      return { ok: false, reason: mapVerifyOtpError(error.message) };
    }

    return { ok: true, type: "code" };
  }

  return { ok: false, reason: "missing" };
}
