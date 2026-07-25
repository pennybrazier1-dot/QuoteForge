import type { Metadata } from "next";
import { QuotePreparationEntry } from "@/components/proposals/quote-preparation-entry";

export const metadata: Metadata = {
  title: "New Quote — QuoteForge",
  description: "Create a new quote in QuoteForge.",
};

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ enquiryId?: string }>;
}) {
  const { enquiryId } = await searchParams;

  return <QuotePreparationEntry enquiryId={enquiryId} />;
}
