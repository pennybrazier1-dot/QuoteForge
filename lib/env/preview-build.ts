/**
 * Preview / development build badge — hidden on Vercel production.
 */

import { isDevTestingEnabled } from "@/lib/env/dev-testing";

export type PreviewBuildInfo = {
  commitSha: string;
};

export function shouldShowPreviewBuildBadge(): boolean {
  return isDevTestingEnabled();
}

export function getPreviewBuildInfo(): PreviewBuildInfo | null {
  if (!shouldShowPreviewBuildBadge()) {
    return null;
  }

  const rawSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA ??
    "unknown";

  return {
    commitSha: rawSha.slice(0, 7),
  };
}
