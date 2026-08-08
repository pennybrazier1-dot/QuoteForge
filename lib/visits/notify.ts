import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import { getSiteUrl } from "@/lib/env/site-url";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";
import {
  formatVisitDateLabel,
  formatVisitDuration,
  formatVisitTimeLabel,
  formatVisitType,
  type VisitRecord,
} from "@/lib/visits/types";

export async function notifyCustomerOfVisit(input: {
  visit: VisitRecord;
  businessName: string | null | undefined;
  replyTo?: string | null;
}): Promise<void> {
  const to = input.visit.contact_email?.trim();
  if (!to) {
    return;
  }

  const businessName = resolveCustomerFacingBusinessName(input.businessName);
  const timeLabel = formatVisitTimeLabel(input.visit.visit_time);
  const when = [
    formatVisitDateLabel(input.visit.visit_date),
    timeLabel,
    formatVisitDuration(input.visit.duration_minutes),
  ]
    .filter(Boolean)
    .join(" · ");

  const result = await sendNotificationEmail({
    to,
    subject: `${businessName}: site visit booked`,
    businessName,
    replyTo: input.replyTo,
    ctaUrl: `${getSiteUrl()}/`,
    ctaLabel: "Open Reanvil",
    message: [
      `Hi${input.visit.customer_name ? ` ${input.visit.customer_name}` : ""},`,
      "",
      `${businessName} has booked a ${formatVisitType(input.visit.visit_type).toLowerCase()}.`,
      "",
      `When: ${when}`,
      input.visit.enquiry_summary?.trim()
        ? `About: ${input.visit.enquiry_summary.trim()}`
        : "",
      "",
      "If you need to change this, reply to this email.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!result.ok) {
    console.warn("[visit-notify]", result.error);
  }
}
