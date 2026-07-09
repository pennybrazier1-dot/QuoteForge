export type SiteVisitTimeSlot = {
  id: string;
  label: string;
  confirmationLine: string;
};

export const SITE_VISIT_TIME_SLOTS: SiteVisitTimeSlot[] = [
  {
    id: "tomorrow-10",
    label: "Tomorrow 10:00",
    confirmationLine: "tomorrow at 10:00",
  },
  {
    id: "tomorrow-14",
    label: "Tomorrow 14:00",
    confirmationLine: "tomorrow at 14:00",
  },
  {
    id: "thursday-0930",
    label: "Thursday 09:30",
    confirmationLine: "Thursday at 9:30",
  },
  {
    id: "friday-1300",
    label: "Friday 13:00",
    confirmationLine: "Friday at 13:00",
  },
];

export function getCustomerFirstName(customerName: string): string {
  const trimmed = customerName.trim();
  if (!trimmed) {
    return "there";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function buildSiteVisitOutreachMessage(customerName: string): string {
  const firstName = getCustomerFirstName(customerName);

  return `Hi ${firstName}, thanks for your enquiry. I'd like to arrange a site visit so I can take a look, discuss the work, and prepare an accurate quote. Would any of these times work for you?`;
}

export function buildSiteVisitConfirmationMessage(
  customerName: string,
  businessName: string,
  confirmationLine: string
): string {
  const firstName = getCustomerFirstName(customerName);
  const business = businessName.trim() || "us";

  return `Hi ${firstName}, your site visit with ${business} is booked for ${confirmationLine}. Please make sure the work area is accessible.`;
}

export function buildSiteVisitEmailSubject(businessName: string): string {
  const business = businessName.trim() || "QuoteForge";
  return `Site visit for your enquiry — ${business}`;
}
