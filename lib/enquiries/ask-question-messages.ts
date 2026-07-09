import { getCustomerFirstName } from "@/lib/enquiries/site-visit-messages";

export function buildAskQuestionMessage(customerName: string): string {
  const firstName = getCustomerFirstName(customerName);

  return `Hi ${firstName}, thanks for your enquiry. I just need to confirm a couple of details before arranging the next step.`;
}

export function buildAskQuestionEmailSubject(businessName: string): string {
  const business = businessName.trim() || "QuoteForge";
  return `Quick question about your enquiry — ${business}`;
}

export const ASK_QUESTION_DIALOG_THEME = {
  panel: "qf-enquiry-site-visit-panel",
  body: "qf-enquiry-site-visit-body",
  sectionTitle: "qf-enquiry-site-visit-section-title",
  message: "qf-enquiry-site-visit-message",
  contactButton: "qf-enquiry-site-visit-contact-btn",
} as const;
