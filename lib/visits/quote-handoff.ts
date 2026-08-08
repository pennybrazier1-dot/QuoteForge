import type { ProposalFormValues } from "@/lib/proposals/form-values";
import {
  formatVisitAddress,
  type VisitRecord,
} from "@/lib/visits/types";

/** Combine enquiry summary + visit notes for Quick Quote site notes. */
export function buildVisitQuoteSiteNotes(visit: VisitRecord): string {
  const summary = visit.enquiry_summary.trim();
  const notes = visit.notes.trim();

  if (summary && notes) {
    return `Enquiry summary:\n${summary}\n\nVisit notes:\n${notes}`;
  }
  if (notes) {
    return notes;
  }
  if (summary) {
    return summary;
  }
  return "";
}

export function buildProposalInitialValuesFromVisit(
  visit: VisitRecord
): ProposalFormValues {
  return {
    customerName: visit.customer_name,
    propertyAddress: formatVisitAddress(visit),
    phoneNumber: visit.contact_phone,
    emailAddress: visit.contact_email,
    jobDescription: buildVisitQuoteSiteNotes(visit),
    optionalExtras: "",
    estimatedPrice: "",
    estimatedDuration: "",
    plannedStartDateText: "",
    plannedStartDateExact: "",
  };
}

export function buildCreateQuoteFromVisitHref(visitId: string): string {
  return `/proposals/new?visitId=${encodeURIComponent(visitId)}`;
}
