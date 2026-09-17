"use client";

import { NewProposalForm } from "@/components/proposals/new-proposal-form";
import { QuotePreparationForm } from "@/components/proposals/quote-preparation-form";
import type { CustomerNameMatchOption } from "@/lib/customers/name-match";
import type { ProposalFormValues } from "@/lib/proposals/form-values";

/** Enquiry path uses QuotePreparationForm; blank /proposals/new is trader quick quote. */
export function shouldUseQuotePreparation(enquiryId?: string): boolean {
  return Boolean(enquiryId?.trim());
}

export function QuotePreparationEntry({
  enquiryId,
  visitId,
  visitInitialValues,
  customers = [],
}: {
  enquiryId?: string;
  visitId?: string;
  visitInitialValues?: ProposalFormValues;
  customers?: CustomerNameMatchOption[];
}) {
  if (visitId?.trim()) {
    return (
      <NewProposalForm
        visitId={visitId.trim()}
        initialValues={visitInitialValues}
        customers={customers}
      />
    );
  }

  if (shouldUseQuotePreparation(enquiryId)) {
    return <QuotePreparationForm enquiryId={enquiryId!.trim()} />;
  }

  return <NewProposalForm customers={customers} />;
}
