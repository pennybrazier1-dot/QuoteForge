/**
 * Prepare Quote for an enquiry. Pass visitId when opening from a specific
 * appointment so capture notes/photos/measurements match that visit.
 */
export function buildQuotePreparationPath(
  enquiryId: string,
  visitId?: string | null
): string {
  const params = new URLSearchParams();
  params.set("enquiryId", enquiryId);
  const trimmedVisitId = visitId?.trim();
  if (trimmedVisitId) {
    params.set("visitId", trimmedVisitId);
  }
  return `/proposals/new?${params.toString()}`;
}
