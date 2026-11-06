import { assembleTransactionalEmail } from "@/lib/email/transactional-email";
import { buildProposalEmailGreeting } from "@/lib/email/proposal-email-presentation";
import {
  outboundStatusDetail,
  outboundStatusLabel,
} from "@/lib/outbound/status-labels";
import {
  OUTBOUND_PROVIDER_ACCEPTED_NOTE,
  type OutboundStatus,
} from "@/lib/outbound/types";
import {
  buildCustomerInvoicePdfUrl,
  buildCustomerProposalPortalUrl,
} from "@/lib/proposals/customer-portal/token";
import { formatPenceAsGbp } from "@/lib/proposals/money";

export type InvoiceEmailDeliveryState = {
  skipped?: "no_recipient" | "already_terminal" | "not_notifiable";
  status?: string;
  unknownOutcome?: boolean;
  providerAccepted?: boolean;
  simulated?: boolean;
  outboundId?: string;
};

const TERMINAL_HIDE_STATUSES = new Set([
  "provider_accepted",
  "simulated",
  "unknown",
  "sending",
]);

function isOutboundStatus(value: string | null | undefined): value is OutboundStatus {
  return (
    value === "needed" ||
    value === "sending" ||
    value === "provider_accepted" ||
    value === "failed" ||
    value === "unknown" ||
    value === "simulated"
  );
}

/**
 * Issued-invoice email only.
 * States the balance. Does not say a payment was received or that the customer opened the email.
 */
export function buildInvoiceIssuedEmail(input: {
  businessName: string;
  customerName: string | null;
  jobTitle: string;
  invoiceNumber: string;
  totalAmount: number;
  balanceDue: number;
  portalToken: string;
  logoUrl?: string | null;
}) {
  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const ctaUrl = buildCustomerProposalPortalUrl(input.portalToken);
  const pdfUrl = buildCustomerInvoicePdfUrl(input.portalToken);
  const totalLabel = formatPenceAsGbp(input.totalAmount);
  const balanceLabel = formatPenceAsGbp(input.balanceDue);
  const balanceCopy = `Balance still to pay: ${balanceLabel}.`;

  return assembleTransactionalEmail({
    subject: input.businessName
      ? `Invoice ${input.invoiceNumber} from ${input.businessName}`
      : `Invoice ${input.invoiceNumber}`,
    content: {
      audience: "customer",
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      heading: "Your invoice",
      greeting: buildProposalEmailGreeting(firstName),
      intro: `Your invoice for ${input.jobTitle} is ready to review. A PDF copy is attached.`,
      accentBorder: true,
      summaryRows: [
        { label: "Invoice", value: input.invoiceNumber },
        { label: "Job", value: input.jobTitle },
        { label: "Total", value: totalLabel },
        { label: "Balance", value: balanceLabel },
      ],
      ctaLabel: "View invoice in portal",
      ctaUrl,
      fallbackLabel: "Open secure portal",
      supportText: `${balanceCopy} This email does not confirm that a payment has been received. You can also download the PDF: ${pdfUrl}`,
      preheader: `Invoice ${input.invoiceNumber} for ${input.jobTitle}`,
    },
  });
}

export function describeInvoiceEmailFeedback(input: {
  skipped?: InvoiceEmailDeliveryState["skipped"];
  status?: string | null;
  unknownOutcome?: boolean;
  providerAccepted?: boolean;
  simulated?: boolean;
  error?: string | null;
} | null): { title: string; detail: string } | null {
  if (!input) return null;

  if (input.skipped === "no_recipient") {
    return {
      title: "Customer email missing",
      detail:
        "Add a customer email on the invoice before sending. No email was sent.",
    };
  }
  if (input.skipped === "not_notifiable") {
    return {
      title: "Invoice is not approved",
      detail: "Approve the invoice before emailing the customer. No email was sent.",
    };
  }
  if (input.status === "sending") {
    return {
      title: "Sending in progress",
      detail: outboundStatusDetail("sending"),
    };
  }
  if (input.unknownOutcome || input.status === "unknown") {
    return {
      title: "Delivery outcome unknown — do not resend",
      detail: input.error || outboundStatusDetail("unknown"),
    };
  }
  if (input.skipped === "already_terminal") {
    return {
      title: "Already accepted by the provider",
      detail: OUTBOUND_PROVIDER_ACCEPTED_NOTE,
    };
  }
  if (input.providerAccepted || input.status === "provider_accepted") {
    return {
      title: outboundStatusLabel("provider_accepted"),
      detail: OUTBOUND_PROVIDER_ACCEPTED_NOTE,
    };
  }
  if (input.simulated || input.status === "simulated") {
    return {
      title: outboundStatusLabel("simulated"),
      detail: outboundStatusDetail("simulated"),
    };
  }
  if (input.status === "failed") {
    return {
      title: outboundStatusLabel("failed"),
      detail: outboundStatusDetail("failed"),
    };
  }
  if (input.status === "needed") {
    return {
      title: outboundStatusLabel("needed"),
      detail: outboundStatusDetail("needed"),
    };
  }
  if (input.error) {
    return {
      title: "Invoice email was not sent",
      detail: input.error,
    };
  }
  return null;
}

export function canShowInvoiceEmailButton(input: {
  status: string;
  customerEmail: string | null | undefined;
  outboundStatus?: string | null;
  session?: InvoiceEmailDeliveryState | null;
}): boolean {
  if (input.status !== "approved") return false;
  const email = input.customerEmail?.trim() ?? "";
  if (!email.includes("@")) return false;
  if (input.outboundStatus && TERMINAL_HIDE_STATUSES.has(input.outboundStatus)) {
    return false;
  }
  const session = input.session;
  if (!session) return true;
  if (session.unknownOutcome || session.skipped === "already_terminal") return false;
  if (session.providerAccepted || session.simulated) return false;
  if (session.status && TERMINAL_HIDE_STATUSES.has(session.status)) return false;
  return true;
}

export function invoiceEmailStatusDetail(status: string | null | undefined): string {
  if (!status || !isOutboundStatus(status)) return "";
  return outboundStatusDetail(status);
}
