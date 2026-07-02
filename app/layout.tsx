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

export const metadata: Metadata = {
  title: "QuoteForge — Spend less time quoting. Win more work.",
  description:
    "QuoteForge is an AI sales assistant for self-employed tradespeople and small trade businesses. Turn a few details into polished, professional quotes in minutes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  // Keep the layout viewport stable when the on-screen keyboard opens (iOS Safari).
  interactiveWidget: "resizes-content",
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
