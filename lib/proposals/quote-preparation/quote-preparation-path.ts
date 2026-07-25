export function buildQuotePreparationPath(enquiryId: string): string {
  return `/proposals/new?enquiryId=${encodeURIComponent(enquiryId)}`;
}
