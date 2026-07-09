export const ENQUIRY_DETAIL_VISIBLE_ACTIONS = {
  review: false,
  bookSiteVisit: true,
  askQuestion: true,
  decline: true,
  delete: true,
  backToList: true,
} as const;

export function shouldShowReviewEnquiryOnDetailPage(): boolean {
  return ENQUIRY_DETAIL_VISIBLE_ACTIONS.review;
}
