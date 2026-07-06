/**
 * Temporary platform admin gate while the product is in development.
 * Replace with role-based auth from the database later.
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email?.trim()) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  return getPlatformAdminAllowlist().includes(normalized);
}

function getPlatformAdminAllowlist(): string[] {
  const fromEnv = process.env.PLATFORM_ADMIN_EMAILS;
  if (fromEnv?.trim()) {
    return fromEnv
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}
