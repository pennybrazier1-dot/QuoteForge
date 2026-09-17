import {
  assembleTransactionalEmail,
  type RenderedTransactionalEmail,
} from "@/lib/email/transactional-email";
import {
  buildProposalEmailGreeting,
  formatProposalEmailTime,
  isUsableEmailValue,
  proposalEmailFirstName,
  resolveProposalEmailBusinessName,
  resolveProposalEmailJobTitle,
} from "@/lib/email/proposal-email-presentation";
import { getSiteUrl } from "@/lib/env/site-url";
import { buildCustomerProposalPortalUrl } from "@/lib/proposals/customer-portal/token";
import {
  formatVisitType,
  type VisitRecord,
  type VisitType,
} from "@/lib/visits/types";

export function traderConversationUrl(proposalId: string): string {
  return `${getSiteUrl()}/proposals/${proposalId}#proposal-conversation`;
}

export function customerConversationUrl(token: string): string {
  return `${buildCustomerProposalPortalUrl(token)}#proposal-conversation`;
}

export type TraderActivityEvent =
  | "message"
  | "question"
  | "change_request"
  | "date_request"
  | "date_confirmed"
  | "accepted"
  | "declined"
  | "cancelled";

export function formatVisitEmailDate(dateIso: string | null | undefined): string | null {
  const iso = dateIso?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    return null;
  }
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function visitEmailHeading(): string {
  return "Your visit is booked";
}

export function visitEmailSubject(
  visitType: VisitType | string,
  businessName: string | null
): string {
  const visitLabel = formatVisitType(visitType);
  return businessName
    ? `Your ${visitLabel} with ${businessName}`
    : `Your ${visitLabel} is booked`;
}

export function visitEmailIntro(
  visitType: VisitType | string,
  businessName: string | null
): string {
  const visitLabel = formatVisitType(visitType);
  return businessName
    ? `Your ${visitLabel} with ${businessName} has been arranged.`
    : `Your ${visitLabel} has been arranged.`;
}

export function buildVisitBookingEmail(input: {
  visit: Pick<
    VisitRecord,
    | "visit_type"
    | "visit_date"
    | "visit_time"
    | "enquiry_summary"
    | "customer_name"
  >;
  businessName: string | null | undefined;
  logoUrl?: string | null;
  tradeLabel?: string | null;
  ctaUrl: string;
}): RenderedTransactionalEmail {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const visitLabel = formatVisitType(input.visit.visit_type);
  const greeting = buildProposalEmailGreeting(
    proposalEmailFirstName(input.visit.customer_name)
  );
  const dateLabel = formatVisitEmailDate(input.visit.visit_date);
  const timeLabel = formatProposalEmailTime(input.visit.visit_time);
  const reason = isUsableEmailValue(input.visit.enquiry_summary)
    ? input.visit.enquiry_summary.trim()
    : "";
  const heading = visitEmailHeading();
  const intro = visitEmailIntro(input.visit.visit_type, businessName);
  const content = {
    audience: "customer" as const,
    businessName,
    logoUrl: input.logoUrl,
    tradeLabel: input.tradeLabel,
    heading,
    greeting,
    intro,
    summaryRows: [
      { label: "Visit", value: visitLabel, symbol: "▣" },
      ...(dateLabel ? [{ label: "Date", value: dateLabel, symbol: "▣" }] : []),
      ...(timeLabel ? [{ label: "Time", value: timeLabel, symbol: "◷" }] : []),
      ...(reason ? [{ label: "Reason", value: reason }] : []),
    ],
    ctaLabel: "View visit details",
    ctaUrl: input.ctaUrl,
    fallbackLabel: "Open secure portal",
    preheader: "Your visit has been booked.",
    supportText:
      "If you need to change this visit, open the secure portal. Please do not reply to this email with new dates.",
  };
  return assembleTransactionalEmail({
    subject: visitEmailSubject(input.visit.visit_type, businessName),
    content,
  });
}

export function traderActivityEventFromKindLabel(
  kindLabel: string
): TraderActivityEvent {
  const kind = kindLabel.toLowerCase();
  if (kind.includes("date confirmation")) {
    return "date_confirmed";
  }
  if (kind.includes("date change") || kind.includes("time change")) {
    return "date_request";
  }
  if (kind.includes("accept")) {
    return "accepted";
  }
  if (kind.includes("declin")) {
    return "declined";
  }
  if (kind.includes("cancel")) {
    return "cancelled";
  }
  if (kind.includes("change")) {
    return "change_request";
  }
  if (kind.includes("question")) {
    return "question";
  }
  return "message";
}

function traderCustomerName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return trimmed || "Your customer";
}

function traderActivityCopy(
  event: TraderActivityEvent,
  who: string
): { heading: string; subject: string; intro: string; preheader: string } {
  switch (event) {
    case "change_request":
      return {
        heading: "Customer requested a change",
        subject: `${who} requested a change`,
        intro: `${who} requested a change.`,
        preheader: `${who} requested a change.`,
      };
    case "date_request":
      return {
        heading: "Customer requested another date",
        subject: `${who} requested another date`,
        intro: `${who} requested another date.`,
        preheader: `${who} requested another date.`,
      };
    case "date_confirmed":
      return {
        heading: "Customer confirmed date",
        subject: `${who} confirmed date`,
        intro: `${who} confirmed a proposed date.`,
        preheader: `${who} confirmed a date.`,
      };
    case "accepted":
      return {
        heading: "Customer accepted your proposal",
        subject: `${who} accepted your proposal`,
        intro: `${who} accepted your proposal.`,
        preheader: `${who} accepted your proposal.`,
      };
    case "declined":
      return {
        heading: "Customer declined your proposal",
        subject: `${who} declined your proposal`,
        intro: `${who} declined your proposal.`,
        preheader: `${who} declined your proposal.`,
      };
    case "cancelled":
      return {
        heading: "Customer cancelled",
        subject: `${who} cancelled`,
        intro: `${who} cancelled.`,
        preheader: `${who} cancelled.`,
      };
    case "question":
    case "message":
    default:
      return {
        heading: "New customer message",
        subject: `New message from ${who}`,
        intro: `${who} has sent you a message.`,
        preheader: "You have a new customer message.",
      };
  }
}

export function buildTraderActivityEmail(input: {
  event?: TraderActivityEvent;
  kindLabel?: string;
  customerName: string | null | undefined;
  jobTitle?: string | null;
  proposalNumber?: string | null;
  preview: string;
  proposalId: string;
}): RenderedTransactionalEmail {
  const event =
    input.event ?? traderActivityEventFromKindLabel(input.kindLabel || "message");
  const who = traderCustomerName(input.customerName);
  const copy = traderActivityCopy(event, who);
  const preview =
    input.preview.length > 220
      ? `${input.preview.slice(0, 217).trimEnd()}…`
      : input.preview;
  const jobTitle = resolveProposalEmailJobTitle({
    title: input.jobTitle,
    proposalNumber: input.proposalNumber,
  });
  const regarding =
    jobTitle && jobTitle !== "Your proposal" ? jobTitle : input.proposalNumber?.trim() || "";
  const ctaUrl = traderConversationUrl(input.proposalId);
  return assembleTransactionalEmail({
    subject: copy.subject,
    content: {
      audience: "trader",
      heading: copy.heading,
      intro: copy.intro,
      summaryRows: [
        { label: "Customer", value: who },
        ...(regarding ? [{ label: "Regarding", value: regarding }] : []),
        ...(preview ? [{ label: "Message", value: `"${preview}"` }] : []),
      ],
      ctaLabel: "Open conversation",
      ctaUrl,
      fallbackLabel: "Open in Reanvil",
      preheader: copy.preheader,
    },
  });
}

export function buildCustomerReplyEmail(input: {
  businessName: string | null | undefined;
  customerName: string | null | undefined;
  preview: string;
  portalToken: string;
  logoUrl?: string | null;
  tradeLabel?: string | null;
}): RenderedTransactionalEmail {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const greeting = buildProposalEmailGreeting(
    proposalEmailFirstName(input.customerName)
  );
  const preview =
    input.preview.length > 220
      ? `${input.preview.slice(0, 217).trimEnd()}…`
      : input.preview;
  const intro = businessName
    ? `${businessName} has replied to you.`
    : "You have a new message.";
  const ctaUrl = customerConversationUrl(input.portalToken);
  return assembleTransactionalEmail({
    subject: businessName
      ? `New message from ${businessName}`
      : "You have a new message",
    content: {
      audience: "customer",
      businessName,
      logoUrl: input.logoUrl,
      tradeLabel: input.tradeLabel,
      heading: "You have a new message",
      greeting,
      intro,
      summaryRows: preview ? [{ label: "Message", value: `"${preview}"` }] : [],
      ctaLabel: "View message",
      ctaUrl,
      fallbackLabel: "Open secure portal",
      supportText:
        "Reply through your secure customer portal. Please do not continue this conversation in email.",
      preheader: "You have a new message.",
    },
  });
}

export function buildCustomerDateProposedEmail(input: {
  businessName: string | null | undefined;
  customerName: string | null | undefined;
  slotLabel: string;
  portalToken: string;
  previousDateLabel?: string | null;
  logoUrl?: string | null;
}): RenderedTransactionalEmail {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const greeting = buildProposalEmailGreeting(
    proposalEmailFirstName(input.customerName)
  );
  const intro = businessName
    ? `${businessName} has proposed a new date for your booking.`
    : "A new date has been proposed for your booking.";
  const previous = input.previousDateLabel?.trim() ?? "";
  return assembleTransactionalEmail({
    subject: businessName
      ? `Booking update from ${businessName}`
      : "Booking update",
    content: {
      audience: "customer",
      businessName,
      logoUrl: input.logoUrl,
      heading: "New date proposed",
      greeting,
      intro,
      summaryRows: [
        ...(previous ? [{ label: "Previous date", value: previous }] : []),
        { label: "New proposed date", value: input.slotLabel },
      ],
      ctaLabel: "Confirm date",
      ctaUrl: customerConversationUrl(input.portalToken),
      fallbackLabel: "Open secure portal",
      preheader: "A new date has been proposed.",
    },
  });
}

export function buildCustomerScheduleUpdateEmail(input: {
  businessName: string | null | undefined;
  customerName: string | null | undefined;
  scheduleLabel: string;
  estimatedDuration?: string | null;
  confirmed: boolean;
  portalToken: string;
  logoUrl?: string | null;
}): RenderedTransactionalEmail {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const greeting = buildProposalEmailGreeting(
    proposalEmailFirstName(input.customerName)
  );
  const intro = businessName
    ? `${businessName} has scheduled your job.`
    : "Your job has been scheduled.";
  return assembleTransactionalEmail({
    subject: businessName
      ? `Booking update from ${businessName}`
      : "Booking update",
    content: {
      audience: "customer",
      businessName,
      logoUrl: input.logoUrl,
      heading: "Booking update",
      greeting,
      intro,
      summaryRows: [
        { label: "Date", value: input.scheduleLabel, symbol: "▣" },
        ...(isUsableEmailValue(input.estimatedDuration)
          ? [
              {
                label: "Duration",
                value: input.estimatedDuration.trim(),
                symbol: "◷",
              },
            ]
          : []),
        {
          label: "Status",
          value: input.confirmed ? "Confirmed" : "Provisional",
        },
      ],
      supportText: input.confirmed
        ? "This date is confirmed."
        : "This date is provisionally held and may be confirmed soon.",
      ctaLabel: "View proposal",
      ctaUrl: customerConversationUrl(input.portalToken),
      fallbackLabel: "Open secure portal",
      preheader: "Your booking has been updated.",
    },
  });
}
