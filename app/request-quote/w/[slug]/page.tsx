import type { Metadata } from "next";
import { PublicRequestQuoteApp } from "@/components/customer-journey/public-request-quote-app";

export const metadata: Metadata = {
  title: "Request a Quote",
  description: "Tell us about your project and receive a clear, professional quote.",
};

type PublicRequestQuotePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicRequestQuotePage({
  params,
}: PublicRequestQuotePageProps) {
  const { slug } = await params;

  return <PublicRequestQuoteApp slug={slug} />;
}
