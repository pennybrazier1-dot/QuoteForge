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

function getDevTestingPublicFlag(): string {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production") {
    return "0";
  }

  if (vercelEnv === "preview" || vercelEnv === "development") {
    return "1";
  }

  if (process.env.NODE_ENV === "development") {
    return "1";
  }

  return "0";
}

const nextConfig: NextConfig = {
  // PDFKit loads font metric files from disk at runtime.
  // Keep it external so Next.js does not bundle it with a broken /ROOT path.
  serverExternalPackages: ["pdfkit"],
  env: {
    GIT_COMMIT_SHA: getShortGitSha(),
    NEXT_PUBLIC_GIT_COMMIT_SHA: getShortGitSha(),
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_QF_DEV_TESTING: getDevTestingPublicFlag(),
  },
};

export default nextConfig;
