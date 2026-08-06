import { getSiteUrl } from "@/lib/env/site-url";

/** Absolute URL used in signup / resend confirmation emails. */
export function getAuthConfirmUrl(): string {
  return `${getSiteUrl()}/auth/confirm`;
}

/** Absolute URL used in password recovery emails. */
export function getPasswordResetRedirectUrl(): string {
  return `${getSiteUrl()}/auth/reset-password`;
}

export function buildCheckEmailPath(email: string): string {
  return `/check-email?email=${encodeURIComponent(email.trim())}`;
}

/**
 * Supabase returns a user with an empty identities array when the email is
 * already registered and confirmation is required (fake "success").
 */
export function isDuplicateSignupUser(user: {
  identities?: Array<unknown> | null;
} | null): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}
