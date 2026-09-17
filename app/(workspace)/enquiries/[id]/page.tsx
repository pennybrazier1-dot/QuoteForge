import type { Metadata } from "next";
import { EnquiryDetailView } from "@/components/enquiries/enquiry-detail-view";

export const metadata: Metadata = {
  title: "Review Enquiry",
  description: "Review a customer enquiry in detail.",
};

type EnquiryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EnquiryDetailPage({ params }: EnquiryDetailPageProps) {
  const { id } = await params;

  return (
    <main className="qf-trader-page mx-auto w-full max-w-full flex-1 py-8 sm:py-10 lg:max-w-6xl lg:px-6">
      <EnquiryDetailView enquiryId={id} />
    </main>
  );
}
