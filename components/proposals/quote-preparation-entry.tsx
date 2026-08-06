"use client";

import { NewProposalForm } from "@/components/proposals/new-proposal-form";
import { QuotePreparationForm } from "@/components/proposals/quote-preparation-form";

/** Enquiry path uses QuotePreparationForm; blank /proposals/new is trader quick quote. */
export function shouldUseQuotePreparation(enquiryId?: string): boolean {
  return Boolean(enquiryId?.trim());
}

export function QuotePreparationEntry({
  enquiryId,
}: {
  enquiryId?: string;
}) {
  if (shouldUseQuotePreparation(enquiryId)) {
    return <QuotePreparationForm enquiryId={enquiryId!.trim()} />;
  }

  return <NewProposalForm />;
}
