import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFKit loads font metric files from disk at runtime.
  // Keep it external so Next.js does not bundle it with a broken /ROOT path.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
