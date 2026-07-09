import type { Metadata } from "next";
import { EnquiryDetailView } from "@/components/enquiries/enquiry-detail-view";

export const metadata: Metadata = {
  title: "Review Enquiry — QuoteForge",
  description: "Review a customer enquiry in detail.",
};

type EnquiryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EnquiryDetailPage({ params }: EnquiryDetailPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <EnquiryDetailView enquiryId={id} />
    </main>
  );
}
