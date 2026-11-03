import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import { buildVisitBookingEmail } from "@/lib/email/transactional-events";
import { buildCustomerVisitConfirmationUrl } from "@/lib/visits/customer-confirmation/token";
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

  const token = input.visit.customer_access_token?.trim();
  if (!token) {
    console.warn(
      "[visit-notify] skipped: visit has no customer_access_token"
    );
    return;
  }

  const ctaUrl = buildCustomerVisitConfirmationUrl(token);

  const email = buildVisitBookingEmail({
    visit: input.visit,
    businessName: input.businessName,
    logoUrl: input.logoUrl,
    tradeLabel: input.tradeLabel,
    ctaUrl,
  });

  // Real sends are blocked in local/dev by outboundEmailBlockReason / missing Resend.
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
