/**
 * Development / preview-only testing helpers.
 * Disabled on Vercel production — never expose lifecycle simulation there.
 */

function isDevTestingEnabledFromSignals(options: {
  vercelEnv: string | undefined;
  nodeEnv: string | undefined;
  publicDevTestingFlag: string | undefined;
}): boolean {
  const { vercelEnv, nodeEnv, publicDevTestingFlag } = options;

  if (vercelEnv === "production") {
    return false;
  }

  if (vercelEnv === "preview" || vercelEnv === "development") {
    return true;
  }

  if (publicDevTestingFlag === "1") {
    return true;
  }

  return nodeEnv === "development";
}

/** Server-side — uses runtime VERCEL_ENV (reliable on Vercel). */
export function isDevTestingEnabled(): boolean {
  return isDevTestingEnabledFromSignals({
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    publicDevTestingFlag: process.env.NEXT_PUBLIC_QF_DEV_TESTING,
  });
}

/**
 * Client-side — mirrors server logic using public env vars inlined at build time.
 * Prefer passing isDevTestingEnabled() from a server component when possible.
 */
export function isDevTestingEnabledClient(): boolean {
  return isDevTestingEnabledFromSignals({
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    publicDevTestingFlag: process.env.NEXT_PUBLIC_QF_DEV_TESTING,
  });
}

export function devTestingDisabledMessage(): string {
  return "This testing tool is only available in local development or preview builds.";
}
