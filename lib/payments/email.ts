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
        { label: "Amount requested", value: input.amountLabel },
        { label: "Payment method", value: methodLabel || "See portal" },
      ],
      ctaLabel: "View payment details",
      ctaUrl,
      fallbackLabel: "Open secure portal",
      supportText:
        "Bank details are in your secure portal. Your trader records payments when they arrive — transfers are not detected automatically.",
      preheader: `Payment for ${input.jobTitle} is ready.`,
    },
  });
}

/** Partial deposit/instalment — must not say the invoice is fully paid. */
export function buildPaymentPartialReceivedEmail(input: {
  businessName: string;
  customerName: string | null;
  jobTitle: string;
  amountLabel: string;
  outstandingLabel: string;
  portalToken: string;
  logoUrl?: string | null;
  tradeLabel?: string | null;
}) {
  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const ctaUrl = buildCustomerProposalPortalUrl(input.portalToken);
  return assembleTransactionalEmail({
    subject: input.businessName
      ? `Payment recorded by ${input.businessName}`
      : "Payment recorded",
    content: {
      audience: "customer",
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      tradeLabel: input.tradeLabel,
      heading: "Payment recorded",
      greeting: buildProposalEmailGreeting(firstName),
      intro: `We've recorded a payment of ${input.amountLabel} for ${input.jobTitle}. A balance of ${input.outstandingLabel} remains outstanding.`,
      summaryRows: [
        { label: "Job", value: input.jobTitle },
        { label: "Payment recorded", value: input.amountLabel },
        { label: "Outstanding balance", value: input.outstandingLabel },
      ],
      ctaLabel: "View job",
      ctaUrl,
      fallbackLabel: "Open secure portal",
      supportText:
        "Payments are recorded by your trader when they arrive — not detected automatically from your bank.",
      preheader: `Payment of ${input.amountLabel} recorded. ${input.outstandingLabel} outstanding.`,
    },
  });
}

/** Final / paid-in-full confirmation. */
export function buildPaymentReceivedEmail(input: {
  businessName: string;
  customerName: string | null;
  jobTitle: string;
  amountLabel: string;
  portalToken: string;
  logoUrl?: string | null;
  tradeLabel?: string | null;
  fullyPaid?: boolean;
}) {
  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const ctaUrl = buildCustomerProposalPortalUrl(input.portalToken);
  const fullyPaid = input.fullyPaid !== false;
  return assembleTransactionalEmail({
    subject: input.businessName
      ? fullyPaid
        ? `Payment complete — ${input.businessName}`
        : `Payment received by ${input.businessName}`
      : fullyPaid
        ? "Payment complete"
        : "Payment received",
    content: {
      audience: "customer",
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      tradeLabel: input.tradeLabel,
      heading: fullyPaid ? "Paid in full" : "Payment received",
      greeting: buildProposalEmailGreeting(firstName),
      intro: fullyPaid
        ? `Thank you. Your payment of ${input.amountLabel} for ${input.jobTitle} has been recorded and this invoice is now paid in full.`
        : `Thank you. Your payment of ${input.amountLabel} for ${input.jobTitle} has been marked as received.`,
      summaryRows: [
        { label: "Job", value: input.jobTitle },
        { label: "Amount", value: input.amountLabel },
        ...(fullyPaid
          ? [{ label: "Status", value: "Paid in full" as string }]
          : []),
      ],
      ctaLabel: "View job",
      ctaUrl,
      fallbackLabel: "Open secure portal",
      supportText:
        "Payments are recorded by your trader when they arrive — not detected automatically from your bank.",
      preheader: fullyPaid
        ? `${input.jobTitle} is paid in full.`
        : `Payment of ${input.amountLabel} has been received.`,
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
