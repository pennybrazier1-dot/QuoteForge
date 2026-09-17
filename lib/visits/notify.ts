import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import { buildVisitBookingEmail } from "@/lib/email/transactional-events";
import { getSiteUrl } from "@/lib/env/site-url";
import { type VisitRecord } from "@/lib/visits/types";

export async function notifyCustomerOfVisit(input: {
  visit: VisitRecord;
  businessName: string | null | undefined;
  replyTo?: string | null;
  logoUrl?: string | null;
  tradeLabel?: string | null;
}): Promise<void> {
  const to = input.visit.contact_email?.trim();
  if (!to) {
    return;
  }

  const email = buildVisitBookingEmail({
    visit: input.visit,
    businessName: input.businessName,
    logoUrl: input.logoUrl,
    tradeLabel: input.tradeLabel,
    ctaUrl: `${getSiteUrl()}/`,
  });

  const result = await sendNotificationEmail({
    to,
    subject: email.subject,
    businessName: email.businessName,
    replyTo: input.replyTo,
    ctaUrl: email.ctaUrl,
    ctaLabel: email.ctaLabel,
    message: email.text,
    html: email.html,
    heading: email.heading,
    preheader: email.preheader,
    audience: "customer",
  });

  if (!result.ok) {
    console.warn("[visit-notify]", result.error);
  }
}
