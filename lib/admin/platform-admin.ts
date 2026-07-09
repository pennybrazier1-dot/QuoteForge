import { isDevTestingEnabled } from "@/lib/env/dev-testing";

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
 * Temporary platform admin gate while the product is in development.
 * Replace with role-based auth from the database later.
 *
 * - Dev/preview builds: allow access (signed-in check happens in assertAdminAccess).
 * - Production: require email on PLATFORM_ADMIN_EMAILS allowlist.
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (isDevTestingEnabled()) {
    return true;
  }

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

function getPlatformAdminAllowlist(): string[] {
  const fromEnv = process.env.PLATFORM_ADMIN_EMAILS;
  if (!fromEnv?.trim()) {
    return [];
  }

  return fromEnv
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, "").toLowerCase())
    .filter(Boolean);
}
