/**
 * Development / preview-only testing helpers.
 * Disabled on Vercel production — never expose lifecycle simulation there.
 */

export function isDevTestingEnabled(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production") {
    return false;
  }

  if (vercelEnv === "preview") {
    return true;
  }

  return process.env.NODE_ENV === "development";
}

/** Client-side mirror of isDevTestingEnabled (via next.config env). */
export function isDevTestingEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_QF_DEV_TESTING === "1";
}

export function devTestingDisabledMessage(): string {
  return "This testing tool is only available in local development or preview builds.";
}
