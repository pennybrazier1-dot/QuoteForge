"use client";

import { NewProposalForm } from "@/components/proposals/new-proposal-form";
import { QuotePreparationForm } from "@/components/proposals/quote-preparation-form";
import type { CustomerNameMatchOption } from "@/lib/customers/name-match";
import type { ProposalFormValues } from "@/lib/proposals/form-values";

/** Enquiry path uses QuotePreparationForm; blank /proposals/new is trader quick quote. */
export function shouldUseQuotePreparation(enquiryId?: string): boolean {
  return Boolean(enquiryId?.trim());
}

/**
 * When a booking visit is linked to an enquiry, Prepare Quote loads that
 * visit's capture. Calendar-only visits without an enquiry keep Quick Quote.
 */
export function shouldUseVisitCaptureQuotePreparation(options: {
  enquiryId?: string | null;
  visitId?: string | null;
}): boolean {
  return Boolean(options.enquiryId?.trim() && options.visitId?.trim());
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
  const trimmedEnquiryId = enquiryId?.trim() || "";
  const trimmedVisitId = visitId?.trim() || "";

  if (
    shouldUseVisitCaptureQuotePreparation({
      enquiryId: trimmedEnquiryId,
      visitId: trimmedVisitId,
    })
  ) {
    return (
      <QuotePreparationForm
        enquiryId={trimmedEnquiryId}
        visitId={trimmedVisitId}
      />
    );
  }

  if (trimmedVisitId) {
    return (
      <NewProposalForm
        visitId={trimmedVisitId}
        initialValues={visitInitialValues}
        customers={customers}
      />
    );
  }

  if (shouldUseQuotePreparation(trimmedEnquiryId)) {
    return <QuotePreparationForm enquiryId={trimmedEnquiryId} />;
  }

  return <NewProposalForm customers={customers} />;
}
