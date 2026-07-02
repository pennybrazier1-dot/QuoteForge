/**
 * Preview / development build badge — hidden on Vercel production.
 */

export type PreviewBuildInfo = {
  commitSha: string;
};

export function shouldShowPreviewBuildBadge(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production") {
    return false;
  }

  if (vercelEnv === "preview") {
    return true;
  }

  return process.env.NODE_ENV === "development";
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
