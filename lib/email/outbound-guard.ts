/**
 * Server-side outbound email guard for local/dev isolation.
 * Browser request interception alone is not enough — Resend must be refused
 * here whenever the app is pointed at local Supabase.
 */

export function isLocalSupabaseHost(url = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (!url?.trim()) {
    return false;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Returns an error message when outbound email must not leave this machine.
 * Empty RESEND_API_KEY remains the primary block; this is a second boundary.
 */
export function outboundEmailBlockReason(): string | null {
  if (!isLocalSupabaseHost()) {
    return null;
  }
  // Explicit override only for rare intentional local provider tests.
  if (process.env.REANVIL_ALLOW_LOCAL_OUTBOUND === "1") {
    return null;
  }
  return "Outbound email is blocked for local Supabase. Use the labelled simulation path or unset RESEND_API_KEY.";
}
