export const ENQUIRY_DETAIL_VISIBLE_ACTIONS = {
  review: false,
  bookVisit: true,
  createQuote: true,
  replyToCustomer: true,
  decline: true,
  delete: true,
  backToList: true,
} as const;

export function shouldShowReviewEnquiryOnDetailPage(): boolean {
  return ENQUIRY_DETAIL_VISIBLE_ACTIONS.review;
}
