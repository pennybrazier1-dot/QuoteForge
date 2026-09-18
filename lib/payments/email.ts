import { assembleTransactionalEmail } from "@/lib/email/transactional-email";
import { buildProposalEmailGreeting } from "@/lib/email/proposal-email-presentation";
import { buildCustomerProposalPortalUrl } from "@/lib/proposals/customer-portal/token";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/job-payment";
import type { PaymentMethod } from "@/lib/payments/types";

export function buildPaymentRequestedEmail(input: {
  businessName: string;
  customerName: string | null;
  jobTitle: string;
  amountLabel: string;
  methods: PaymentMethod[];
  portalToken: string;
  logoUrl?: string | null;
  tradeLabel?: string | null;
}) {
  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const methodLabel = input.methods
    .map((method) => PAYMENT_METHOD_LABELS[method])
    .join(", ");
  const ctaUrl = buildCustomerProposalPortalUrl(input.portalToken);
  return assembleTransactionalEmail({
    subject: input.businessName
      ? `Payment requested from ${input.businessName}`
      : "Payment requested",
    content: {
      audience: "customer",
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      tradeLabel: input.tradeLabel,
      heading: "Payment requested",
      greeting: buildProposalEmailGreeting(firstName),
      intro: `Your payment for ${input.jobTitle} is ready.`,
      accentBorder: true,
      summaryRows: [
        { label: "Job", value: input.jobTitle },
        { label: "Amount due", value: input.amountLabel },
        { label: "Payment method", value: methodLabel || "See portal" },
      ],
      ctaLabel: "View payment details",
      ctaUrl,
      fallbackLabel: "Open secure portal",
      supportText: "Secure customer portal",
      preheader: `Payment for ${input.jobTitle} is ready.`,
    },
  });
}

export function buildPaymentReceivedEmail(input: {
  businessName: string;
  customerName: string | null;
  jobTitle: string;
  amountLabel: string;
  portalToken: string;
  logoUrl?: string | null;
  tradeLabel?: string | null;
}) {
  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const ctaUrl = buildCustomerProposalPortalUrl(input.portalToken);
  return assembleTransactionalEmail({
    subject: input.businessName
      ? `Payment received by ${input.businessName}`
      : "Payment received",
    content: {
      audience: "customer",
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      tradeLabel: input.tradeLabel,
      heading: "Payment received",
      greeting: buildProposalEmailGreeting(firstName),
      intro: `Thank you. Your payment of ${input.amountLabel} for ${input.jobTitle} has been marked as received.`,
      summaryRows: [
        { label: "Job", value: input.jobTitle },
        { label: "Amount", value: input.amountLabel },
      ],
      ctaLabel: "View job",
      ctaUrl,
      fallbackLabel: "Open secure portal",
      supportText: "Secure customer portal",
      preheader: `Payment of ${input.amountLabel} has been received.`,
    },
  });
}

export function emailContainsBankDetails(html: string, bank: {
  sortCode?: string | null;
  accountNumber?: string | null;
}): boolean {
  const sort = bank.sortCode?.trim();
  const account = bank.accountNumber?.trim();
  return Boolean(
    (sort && html.includes(sort)) || (account && html.includes(account))
  );
}
