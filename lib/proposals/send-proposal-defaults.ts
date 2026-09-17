export type SendProposalContext = {
  proposalId: string;
  proposalNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerId: string | null;
  businessName: string;
  senderName: string;
};

export function buildSendProposalSubject(
  _customerName: string,
  businessName?: string
): string {
  const business = businessName?.trim() || "your business";
  return `Your proposal from ${business} is ready`;
}

export function buildSendProposalMessage(
  customerName: string,
  businessName: string,
  portalUrl?: string
): string {
  const name = customerName.trim() || "there";
  const business = businessName.trim() || "Your business";
  const linkBlock = portalUrl?.trim()
    ? `\nView your proposal:\n${portalUrl.trim()}\n`
    : "";

  return `Hi ${name},

Your proposal from ${business} is ready.

You can review it online and reply on the proposal page if you have a question.
${linkBlock}
A PDF copy is also attached for your records.

Kind regards,
${business}`;
}

export function getSendProposalPdfFileName(proposalNumber: string): string {
  return `${proposalNumber.replace(/\s+/g, "-")}.pdf`;
}
