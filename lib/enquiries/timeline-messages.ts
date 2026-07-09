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

export function formatTimelineSiteVisitStarted(): string {
  return "Site visit started.";
}

export function formatTimelineSiteVisitVoiceNoteCaptured(): string {
  return "Voice note captured on site.";
}

export function formatTimelineSiteVisitPhotoAdded(): string {
  return "Site visit photo added.";
}

export function formatTimelineSiteVisitMeasurementsRecorded(): string {
  return "Measurements recorded on site.";
}

export function formatTimelineSiteVisitNotesAdded(): string {
  return "Visit notes added.";
}

export function formatTimelineSiteVisitChecklistUpdated(): string {
  return "Site visit checklist updated.";
}

export function formatTimelineSiteVisitChecklistCompleted(): string {
  return "Site visit checklist completed.";
}

export function formatTimelineSiteVisitCompleted(): string {
  return "Site visit completed.";
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
