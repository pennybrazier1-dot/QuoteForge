import type { Metadata } from "next";
import { QuotePreparationEntry } from "@/components/proposals/quote-preparation-entry";

export const metadata: Metadata = {
  title: "New Quote",
  description:
    "Create a quick quote from a call, visit, message, or referral.",
};

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ enquiryId?: string }>;
}) {
  const { enquiryId } = await searchParams;

  return <QuotePreparationEntry enquiryId={enquiryId} />;
}
