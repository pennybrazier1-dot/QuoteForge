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
  return `Your Reanvil Proposal – ${name}`;
}

export function buildSendProposalMessage(
  customerName: string,
  businessName: string,
  portalUrl?: string
): string {
  const name = customerName.trim() || "there";
  const business = businessName.trim() || "Your business";
  const linkBlock = portalUrl?.trim()
    ? `\nView & respond to your proposal:\n${portalUrl.trim()}\n`
    : "";

  return `Hi ${name},

Thank you for taking the time to meet with me.

Please find your proposal for the work we discussed. You can review it online and respond without creating an account.
${linkBlock}
A PDF copy is also attached for your records.

If you have any questions, please don't hesitate to get in touch.

Kind regards,
${business}`;
}

export function getSendProposalPdfFileName(proposalNumber: string): string {
  return `${proposalNumber.replace(/\s+/g, "-")}.pdf`;
}
