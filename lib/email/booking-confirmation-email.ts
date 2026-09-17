import {
  BOOKING_EMAIL_CTA_LABEL,
  BOOKING_EMAIL_FALLBACK_LINK_LABEL,
  BOOKING_EMAIL_HEADING,
  BOOKING_EMAIL_PREHEADER,
  BOOKING_EMAIL_SUBJECT_FALLBACK,
  BOOKING_EMAIL_SUPPORTING_COPY,
} from "@/lib/email/customer-email-tokens";
import { renderCustomerEmail } from "@/lib/email/transactional-email";
import {
  buildProposalEmailGreeting,
  formatProposalEmailDuration,
  formatProposalEmailTime,
  isUsableEmailValue,
  proposalEmailFirstName,
  resolveProposalEmailBusinessName,
  resolveProposalEmailJobTitle,
  resolveProposalEmailTradeLabel,
} from "@/lib/email/proposal-email-presentation";

export type BookingConfirmationEmailInput = {
  businessName: string | null | undefined;
  businessLogoUrl?: string | null;
  businessTradeLabel?: string | null;
  customerName?: string | null;
  portalUrl: string;
  title?: string | null;
  jobSummary?: string | null;
  proposalNumber?: string | null;
  plannedStartDate?: string | null;
  plannedStartDateText?: string | null;
  plannedStartTime?: string | null;
  estimatedDuration?: string | null;
};

export function formatBookingEmailDate(input: {
  dateIso?: string | null;
  dateText?: string | null;
}): string | null {
  const iso = input.dateIso?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
      .format(new Date(year, month - 1, day))
      .replace(",", "");
  }
  return isUsableEmailValue(input.dateText) ? input.dateText.trim() : null;
}

export function buildBookingConfirmationEmailSubject(
  businessName: string | null | undefined
): string {
  const business = resolveProposalEmailBusinessName(businessName);
  return business
    ? `Booking confirmed with ${business}`
    : BOOKING_EMAIL_SUBJECT_FALLBACK;
}

export function buildBookingConfirmationIntro(
  businessName: string | null
): string {
  return businessName
    ? `Your booking with ${businessName} is confirmed.`
    : "Your booking is confirmed.";
}

export function buildBookingConfirmationFields(input: {
  title?: string | null;
  jobSummary?: string | null;
  proposalNumber?: string | null;
  plannedStartDate?: string | null;
  plannedStartDateText?: string | null;
  plannedStartTime?: string | null;
  estimatedDuration?: string | null;
}): {
  jobTitle: string | null;
  dateLabel: string | null;
  timeLabel: string | null;
  durationLabel: string | null;
} {
  const jobTitle = resolveProposalEmailJobTitle({
    title: input.title,
    jobSummary: input.jobSummary,
    proposalNumber: input.proposalNumber,
  });
  return {
    jobTitle: jobTitle === "Your proposal" ? null : jobTitle,
    dateLabel: formatBookingEmailDate({
      dateIso: input.plannedStartDate,
      dateText: input.plannedStartDateText,
    }),
    timeLabel: formatProposalEmailTime(input.plannedStartTime),
    durationLabel: formatProposalEmailDuration(input.estimatedDuration),
  };
}

export function buildBookingConfirmationEmailText(input: {
  customerName?: string | null;
  businessName: string | null;
  jobTitle: string | null;
  dateLabel: string | null;
  timeLabel: string | null;
  durationLabel: string | null;
  portalUrl: string;
}): string {
  const greeting = buildProposalEmailGreeting(
    proposalEmailFirstName(input.customerName)
  );
  const lines = [
    greeting,
    "",
    buildBookingConfirmationIntro(input.businessName),
  ];
  if (input.jobTitle) {
    lines.push("", "Job", input.jobTitle);
  }
  if (input.dateLabel) {
    lines.push("", "Date", input.dateLabel);
  }
  if (input.timeLabel) {
    lines.push("", "Time", input.timeLabel);
  }
  if (input.durationLabel) {
    lines.push("", "Duration", input.durationLabel);
  }
  lines.push(
    "",
    BOOKING_EMAIL_SUPPORTING_COPY,
    "",
    `${BOOKING_EMAIL_CTA_LABEL}:`,
    input.portalUrl
  );
  return lines.join("\n");
}

export function buildBookingConfirmationEmailHtml(
  input: BookingConfirmationEmailInput
): string {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const tradeLabel = resolveProposalEmailTradeLabel(
    input.businessTradeLabel,
    businessName
  );
  const firstName = proposalEmailFirstName(input.customerName);
  const greeting = buildProposalEmailGreeting(firstName);
  const intro = buildBookingConfirmationIntro(businessName);
  const fields = buildBookingConfirmationFields(input);

  return renderCustomerEmail({
    businessName,
    logoUrl: input.businessLogoUrl,
    tradeLabel,
    heading: BOOKING_EMAIL_HEADING,
    greeting,
    intro,
    summaryRows: [
      ...(fields.jobTitle
        ? [{ label: "Job", value: fields.jobTitle, symbol: "▣" }]
        : []),
      ...(fields.dateLabel
        ? [{ label: "Date", value: fields.dateLabel, symbol: "▣" }]
        : []),
      ...(fields.timeLabel
        ? [{ label: "Time", value: fields.timeLabel, symbol: "◷" }]
        : []),
      ...(fields.durationLabel
        ? [{ label: "Duration", value: fields.durationLabel, symbol: "◷" }]
        : []),
    ],
    ctaLabel: BOOKING_EMAIL_CTA_LABEL,
    ctaUrl: input.portalUrl,
    fallbackIntro: "If the button doesn't work, you can open your secure portal below:",
    fallbackLabel: BOOKING_EMAIL_FALLBACK_LINK_LABEL,
    supportText: BOOKING_EMAIL_SUPPORTING_COPY,
    preheader: BOOKING_EMAIL_PREHEADER,
    title: BOOKING_EMAIL_HEADING,
  });
}

export function buildBookingConfirmationEmail(
  input: BookingConfirmationEmailInput
): {
  subject: string;
  html: string;
  text: string;
  businessName: string;
} {
  const businessName = resolveProposalEmailBusinessName(input.businessName);
  const fields = buildBookingConfirmationFields(input);
  return {
    subject: buildBookingConfirmationEmailSubject(input.businessName),
    html: buildBookingConfirmationEmailHtml(input),
    text: buildBookingConfirmationEmailText({
      customerName: input.customerName,
      businessName,
      jobTitle: fields.jobTitle,
      dateLabel: fields.dateLabel,
      timeLabel: fields.timeLabel,
      durationLabel: fields.durationLabel,
      portalUrl: input.portalUrl,
    }),
    businessName: businessName || "Reanvil",
  };
}
