type AuthUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * Prefer Supabase auth email, then common metadata fallbacks.
 */
export function resolveAuthEmail(
  user: AuthUserLike | null | undefined
): string | null {
  if (!user) {
    return null;
  }

  if (user.email?.trim()) {
    return user.email.trim();
  }

  const metaEmail = user.user_metadata?.email;
  if (typeof metaEmail === "string" && metaEmail.trim()) {
    return metaEmail.trim();
  }

  return null;
}

/**
 * Stage 9K.2 — fail-closed platform administrator check.
 *
 * Platform admin requires an explicit allowlisted login email.
 * Development, preview, NODE_ENV, and NEXT_PUBLIC_QF_DEV_TESTING never grant
 * administrator privileges on their own.
 *
 * Temporary until role-based auth exists in the database.
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  return isPlatformAdminAllowlisted(email);
}

/**
 * True only when the email is on PLATFORM_ADMIN_EMAILS.
 * Same rule as isPlatformAdmin() — kept as a named helper for delete-protection
 * and bootstrap paths that must never trust client/dev flags.
 */
export function isPlatformAdminAllowlisted(
  email: string | null | undefined
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const allowlist = getPlatformAdminAllowlist();
  if (allowlist.length === 0) {
    return false;
  }

  return allowlist.includes(normalized);
}

/** Parsed allowlist (lowercased). Empty when unset — fail closed. */
export function getPlatformAdminAllowlist(): string[] {
  const fromEnv = process.env.PLATFORM_ADMIN_EMAILS;
  if (!fromEnv?.trim()) {
    return [];
  }

  return fromEnv
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, "").toLowerCase())
    .filter(Boolean);
}
