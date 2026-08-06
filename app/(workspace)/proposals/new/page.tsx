import type { Metadata } from "next";
import { QuotePreparationEntry } from "@/components/proposals/quote-preparation-entry";

export const metadata: Metadata = {
  title: "New Quote",
  description: "Create a new quote in Reanvil.",
};

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ enquiryId?: string }>;
}) {
  const { enquiryId } = await searchParams;

  return <QuotePreparationEntry enquiryId={enquiryId} />;
}
