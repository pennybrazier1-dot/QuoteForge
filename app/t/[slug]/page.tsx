import type { Metadata } from "next";
import { PublicRequestQuoteApp } from "@/components/customer-journey/public-request-quote-app";
import { isUsablePublicEnquirySlug } from "@/lib/enquiries/public-link";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Request a Quote",
  description: "Tell us about your project and receive a clear, professional quote.",
};

type PublicTraderEnquiryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicTraderEnquiryPage({
  params,
}: PublicTraderEnquiryPageProps) {
  const { slug } = await params;
  if (!isUsablePublicEnquirySlug(slug)) {
    notFound();
  }

  return <PublicRequestQuoteApp slug={slug} />;
}
