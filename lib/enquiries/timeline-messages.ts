export function formatTimelineEnquiryReceived(customerName: string): string {
  const name = customerName.trim() || "the customer";
  return `Enquiry received from ${name}.`;
}

export function formatTimelinePhotosAdded(): string {
  return "Photos and project details were added to the enquiry.";
}

export function formatTimelineEnquiryReviewed(customerName: string): string {
  const name = customerName.trim() || "the customer";
  return `Enquiry from ${name} was reviewed.`;
}

export function formatTimelineSiteVisitRequested(): string {
  return "Site visit requested.";
}

export function formatTimelineSiteVisitBooked(confirmationLine: string): string {
  return `Site visit booked for ${confirmationLine}.`;
}

export function formatTimelineCustomerConfirmationLinkCreated(): string {
  return "Customer confirmation link created.";
}

export function formatTimelineCustomerMessagePrepared(): string {
  return "Customer message prepared.";
}

export function formatTimelineCustomerMessageCopied(): string {
  return "Customer message copied.";
}

export function formatTimelineCustomerCalled(): string {
  return "Customer contacted by phone.";
}

export function formatTimelineCustomerTextPrepared(): string {
  return "Customer text message prepared.";
}

export function formatTimelineCustomerEmailPrepared(): string {
  return "Customer email prepared.";
}

export function formatTimelineEnquiryDeclined(): string {
  return "Enquiry declined.";
}

export function formatTimelineEnquiryDeleted(customerName: string): string {
  const name = customerName.trim() || "the customer";
  return `Enquiry from ${name} was removed from local testing data.`;
}
