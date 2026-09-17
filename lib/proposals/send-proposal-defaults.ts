import {
  buildProposalEmailSubject,
  proposalEmailFirstName,
  resolveProposalEmailBusinessName,
} from "@/lib/email/proposal-email-presentation";

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
  return buildProposalEmailSubject(businessName);
}

export function buildSendProposalMessage(
  customerName: string,
  businessName: string,
  portalUrl?: string
): string {
  const name = proposalEmailFirstName(customerName) || "there";
  const business = resolveProposalEmailBusinessName(businessName);
  const fromLine = business
    ? `Your proposal from ${business} is ready.`
    : "Your proposal is ready.";
  const signOff = business ? `\nKind regards,\n${business}` : "\nKind regards";
  const linkBlock = portalUrl?.trim()
    ? `\nView your proposal:\n${portalUrl.trim()}\n`
    : "";

  return `Hi ${name},

${fromLine}

You can review it online and reply on the proposal page if you have a question.
${linkBlock}
A PDF copy is also attached for your records.
${signOff}`;
}

export function getSendProposalPdfFileName(proposalNumber: string): string {
  return `${proposalNumber.replace(/\s+/g, "-")}.pdf`;
}
