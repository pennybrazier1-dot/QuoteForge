import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PreviewBuildBadge } from "@/components/dev/preview-build-badge";
import "./globals.css";
import "./shell.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION =
  "Reanvil is the operating system for modern trades businesses.";

export const metadata: Metadata = {
  applicationName: "Reanvil",
  title: {
    default: "Reanvil — Finish work. Not paperwork.",
    template: "%s — Reanvil",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Reanvil",
    "trades",
    "quotes",
    "proposals",
    "invoicing",
    "tradespeople",
    "business software",
  ],
  authors: [{ name: "Reanvil" }],
  creator: "Reanvil",
  publisher: "Reanvil",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Reanvil",
    title: "Reanvil — Finish work. Not paperwork.",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Reanvil — Finish work. Not paperwork.",
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    title: "Reanvil",
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  // Keep the layout viewport stable when the on-screen keyboard opens (iOS Safari).
  interactiveWidget: "resizes-content",
  themeColor: "#0b0b0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Workspace Home theme: app/mobile-home.css via workspace layout. No bg-background on body. */}
      <body className="min-h-full flex flex-col">
        {children}
        <PreviewBuildBadge />
      </body>
    </html>
  );
}
