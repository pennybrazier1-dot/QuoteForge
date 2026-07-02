import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function getShortGitSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }

  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
}

const nextConfig: NextConfig = {
  // PDFKit loads font metric files from disk at runtime.
  // Keep it external so Next.js does not bundle it with a broken /ROOT path.
  serverExternalPackages: ["pdfkit"],
  env: {
    GIT_COMMIT_SHA: getShortGitSha(),
    NEXT_PUBLIC_QF_DEV_TESTING:
      process.env.VERCEL_ENV === "production" ? "0" : "1",
  },
};

export default nextConfig;
