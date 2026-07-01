export type SendProposalContext = {
  proposalId: string;
  proposalNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerId: string | null;
  businessName: string;
  senderName: string;
};

export function buildSendProposalSubject(customerName: string): string {
  const name = customerName.trim() || "your customer";
  return `Your QuoteForge Proposal – ${name}`;
}

export function buildSendProposalMessage(
  customerName: string,
  businessName: string
): string {
  const name = customerName.trim() || "there";
  const business = businessName.trim() || "Your business";

  return `Hi ${name},

Thank you for taking the time to meet with me.

Please find attached your proposal for the work we discussed.

If you have any questions, please don't hesitate to get in touch.

Kind regards,
${business}`;
}

export function getSendProposalPdfFileName(proposalNumber: string): string {
  return `${proposalNumber.replace(/\s+/g, "-")}.pdf`;
}
