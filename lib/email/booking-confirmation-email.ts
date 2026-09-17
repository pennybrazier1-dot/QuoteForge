import {
  BOOKING_EMAIL_CTA_LABEL,
  BOOKING_EMAIL_FALLBACK_LINK_LABEL,
  BOOKING_EMAIL_HEADING,
  BOOKING_EMAIL_PREHEADER,
  BOOKING_EMAIL_SUBJECT_FALLBACK,
  BOOKING_EMAIL_SUPPORTING_COPY,
  CUSTOMER_EMAIL_COLORS as C,
} from "@/lib/email/customer-email-tokens";
import {
  buildCustomerEmailCtaHtml,
  buildCustomerEmailFallbackHtml,
  buildCustomerEmailFooterHtml,
  buildCustomerEmailIdentityHtml,
  customerEmailDetailRow,
  customerEmailSafeHttpUrl,
  customerEmailTextStyle,
  escapeCustomerEmailHtml,
  wrapCustomerEmailDocument,
} from "@/lib/email/customer-email-shell";
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
import { resolveCustomerFacingBusinessLogoUrl } from "@/lib/proposals/pdf/customer-branding";

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
  const portalUrl = customerEmailSafeHttpUrl(input.portalUrl);
  const logoUrl = resolveCustomerFacingBusinessLogoUrl(input.businessLogoUrl);
  const tradeLabel = resolveProposalEmailTradeLabel(
    input.businessTradeLabel,
    businessName
  );
  const firstName = proposalEmailFirstName(input.customerName);
  const greeting = buildProposalEmailGreeting(firstName);
  const intro = buildBookingConfirmationIntro(businessName);
  const fields = buildBookingConfirmationFields(input);

  const identity = buildCustomerEmailIdentityHtml({
    businessName,
    logoUrl,
    tradeLabel,
  });
  const cta = buildCustomerEmailCtaHtml({
    portalUrl,
    ctaLabel: BOOKING_EMAIL_CTA_LABEL,
  });
  const fallbackLink = buildCustomerEmailFallbackHtml({
    portalUrl,
    intro: "If the button doesn't work, you can open your secure portal below:",
    label: BOOKING_EMAIL_FALLBACK_LINK_LABEL,
  });

  const innerRows = `${identity}
          <tr>
            <td align="center" style="padding:0 8px 10px;">
              <h1 class="email-text" style="margin:0;${customerEmailTextStyle(C.text, "font-size:30px;line-height:1.2;font-weight:800;")}">${BOOKING_EMAIL_HEADING}</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 12px 28px;">
              <p class="email-muted" style="margin:0 0 8px;${customerEmailTextStyle(C.muted, "font-size:16px;line-height:1.4;")}">${escapeCustomerEmailHtml(greeting)}</p>
              <p class="email-muted" style="margin:0;${customerEmailTextStyle(C.muted, "font-size:15px;line-height:1.55;")}">${escapeCustomerEmailHtml(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="width:100%;background:${C.card};border:2px solid ${C.accent};border-radius:16px;">
                <tr>
                  <td style="padding:22px 20px 18px;background:${C.card};border-radius:16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${customerEmailDetailRow("▣", "Job", fields.jobTitle)}
                      ${customerEmailDetailRow("▣", "Date", fields.dateLabel)}
                      ${customerEmailDetailRow("◷", "Time", fields.timeLabel)}
                      ${customerEmailDetailRow("◷", "Duration", fields.durationLabel)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>${cta}</td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cardPdf}" style="width:100%;background:${C.cardPdf};border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;background:${C.cardPdf};border-radius:14px;">
                    <p class="email-muted" style="margin:0;${customerEmailTextStyle(C.muted, "font-size:14px;line-height:1.5;")}">${escapeCustomerEmailHtml(BOOKING_EMAIL_SUPPORTING_COPY)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:4px 12px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="1" style="height:1px;line-height:1px;font-size:0;background:${C.divider};">&nbsp;</td>
                </tr>
              </table>
              <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
              ${fallbackLink}
            </td>
          </tr>
          ${buildCustomerEmailFooterHtml()}`;

  return wrapCustomerEmailDocument({
    title: BOOKING_EMAIL_HEADING,
    preheader: BOOKING_EMAIL_PREHEADER,
    innerRows,
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
