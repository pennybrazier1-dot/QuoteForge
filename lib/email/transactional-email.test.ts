import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBookingConfirmationEmailHtml } from "@/lib/email/booking-confirmation-email";
import { CUSTOMER_EMAIL_COLORS } from "@/lib/email/customer-email-tokens";
import { buildProposalEmailHtml } from "@/lib/email/proposal-email-html";
import {
  emailHtmlHasDarkTextOnDarkBackground,
  emailHtmlUsesCssVariables,
  htmlProminentlyShowsPortalUrl,
} from "@/lib/email/proposal-email-presentation";
import { buildNotificationHtml } from "@/lib/email/send-notification-email";
import { buildHtmlEmail as buildProposalSendHtml } from "@/lib/email/send-proposal-email";
import {
  renderCustomerEmail,
  renderTraderEmail,
  stripVisibleEmailUrls,
} from "@/lib/email/transactional-email";
import {
  buildCustomerDateProposedEmail,
  buildCustomerReplyEmail,
  buildCustomerScheduleUpdateEmail,
  buildTraderActivityEmail,
  buildVisitBookingEmail,
  formatVisitEmailDate,
} from "@/lib/email/transactional-events";
import { WORKSPACE_HAS_PERSISTED_LOGO } from "@/lib/proposals/pdf/customer-branding";
import type { VisitRecord } from "@/lib/visits/types";

const portalUrl = "https://app.reanvil.com/p/CEcHRg2ZMCSLkHZS5SqQ3dst";
const traderUrl = "https://app.reanvil.com/proposals/proposal-1#proposal-conversation";

const visitBase = {
  visit_type: "initial_assessment" as const,
  visit_date: "2026-09-24",
  visit_time: "10:30",
  enquiry_summary: "Measure and inspect kitchen before quote",
  customer_name: "Emma Whitfield",
};

function sampleVisit(
  overrides: Partial<Pick<VisitRecord, "visit_type" | "visit_date" | "visit_time" | "enquiry_summary" | "customer_name">> = {}
) {
  return { ...visitBase, ...overrides };
}

function expectDarkShell(
  html: string,
  options: { trader?: boolean; businessName?: string } = {}
) {
  expect(html).toContain(`background:${CUSTOMER_EMAIL_COLORS.page}`);
  expect(html).toContain("#08080a");
  expect(html).toContain("#111114");
  expect(html).toContain("#ff6a1a");
  expect(html).toContain("#f5f5f7");
  expect(html).toContain("#a1a1aa");
  expect(html).toContain("Powered by Reanvil");
  expect(html).toContain("max-width:600px");
  expect(html).toContain('name="color-scheme" content="dark"');
  expect(html).toContain("-webkit-text-fill-color");
  expect(html).not.toMatch(/Your Business/i);
  expect(html).not.toMatch(/<body[^>]*background:\s*#fff/i);
  expect(htmlProminentlyShowsPortalUrl(html)).toBe(false);
  expect(emailHtmlHasDarkTextOnDarkBackground(html)).toBe(false);
  expect(emailHtmlUsesCssVariables(html)).toBe(false);
  if (options.trader) {
    expect(html).toContain("REANVIL");
    expect(html).toContain("Secure Reanvil notification");
  } else {
    expect(html).toContain("secure customer portal");
  }
  if (options.businessName) {
    expect(html).toContain(options.businessName);
  }
}

describe("global Reanvil transactional email shell", () => {
  it("uses the shared dark shell for proposal emails", () => {
    const html = buildProposalEmailHtml({
      businessName: "Carter & Sons Kitchens",
      customerName: "Emma Whitfield",
      portalUrl,
      title: "Kitchen installation",
    });
    expectDarkShell(html, { businessName: "Carter &amp; Sons Kitchens" });
    expect(html).toContain("Your proposal is ready");
    expect(html).toContain("View proposal");
  });

  it("uses the shared dark shell for booking confirmation emails", () => {
    const html = buildBookingConfirmationEmailHtml({
      businessName: "Carter & Sons Kitchens",
      customerName: "Emma Whitfield",
      portalUrl,
      title: "Bathroom renovation",
      plannedStartDate: "2026-09-18",
      plannedStartTime: "09:00",
      estimatedDuration: "5 days",
    });
    expectDarkShell(html, { businessName: "Carter &amp; Sons Kitchens" });
    expect(html).toContain("Booking confirmed");
    expect(html).toContain("Bathroom renovation");
  });

  it("uses the shared dark shell for Initial Visit booking emails", () => {
    const email = buildVisitBookingEmail({
      visit: sampleVisit(),
      businessName: "Carter & Sons Kitchens",
      ctaUrl: "https://app.reanvil.com/",
    });
    expectDarkShell(email.html, { businessName: "Carter &amp; Sons Kitchens" });
    expect(email.heading).toBe("Your visit is booked");
    expect(email.subject).toBe(
      "Your Initial Visit with Carter & Sons Kitchens"
    );
    expect(email.html).toContain("Initial Visit");
    expect(email.html).toContain("24 September 2026");
    expect(email.html).toContain("10:30");
    expect(email.html).toContain("Measure and inspect kitchen before quote");
    expect(email.preheader).toBe("Your visit has been booked.");
    expect(formatVisitEmailDate("2026-09-24")).toBe("24 September 2026");
  });

  it("uses the shared dark shell for Follow-Up Visit booking emails", () => {
    const email = buildVisitBookingEmail({
      visit: sampleVisit({ visit_type: "follow_up" }),
      businessName: "Carter & Sons Kitchens",
      ctaUrl: "https://app.reanvil.com/",
    });
    expectDarkShell(email.html);
    expect(email.subject).toBe(
      "Your Follow-Up Visit with Carter & Sons Kitchens"
    );
    expect(email.html).toContain("Follow-Up Visit");
  });

  it("uses the shared dark shell for Final Inspection booking emails", () => {
    const email = buildVisitBookingEmail({
      visit: sampleVisit({ visit_type: "final_inspection" }),
      businessName: "Carter & Sons Kitchens",
      ctaUrl: "https://app.reanvil.com/",
    });
    expectDarkShell(email.html);
    expect(email.subject).toBe(
      "Your Final Inspection with Carter & Sons Kitchens"
    );
    expect(email.html).toContain("Final Inspection");
  });

  it("uses the dark shell for customer-message-to-trader emails", () => {
    const email = buildTraderActivityEmail({
      event: "message",
      customerName: "Jessica Walker",
      jobTitle: "Garden makeover",
      preview: "Could we move the date to Friday?",
      proposalId: "proposal-1",
    });
    expectDarkShell(email.html, { trader: true });
    expect(email.subject).toBe("New message from Jessica Walker");
    expect(email.heading).toBe("New customer message");
    expect(email.html).toContain("Jessica Walker");
    expect(email.html).toContain("Garden makeover");
    expect(email.html).toContain("Could we move the date to Friday?");
    expect(email.html).toContain("Open conversation");
    expect(email.preheader).toBe("You have a new message in Reanvil.");
    expect(email.ctaUrl).toContain("/proposals/proposal-1");
  });

  it("uses the dark shell for trader-reply-to-customer emails", () => {
    const email = buildCustomerReplyEmail({
      businessName: "Carter & Sons Kitchens",
      customerName: "Jessica Walker",
      preview: "Friday morning works for us.",
      portalToken: "CEcHRg2ZMCSLkHZS5SqQ3dst",
    });
    expectDarkShell(email.html, { businessName: "Carter &amp; Sons Kitchens" });
    expect(email.subject).toBe("New message from Carter & Sons Kitchens");
    expect(email.heading).toBe("You have a new message");
    expect(email.html).toContain("sent you a message");
    expect(email.html).toContain("View message");
    expect(email.ctaLabel).toBe("View message");
    expect(email.text).toContain("/p/");
  });

  it("uses the dark shell for customer date-change notifications", () => {
    const customer = buildCustomerDateProposedEmail({
      businessName: "Carter & Sons Kitchens",
      customerName: "Emma Whitfield",
      slotLabel: "Friday 25 September 2026 at 09:00",
      previousDateLabel: "Thursday 24 September 2026 at 09:00",
      portalToken: "CEcHRg2ZMCSLkHZS5SqQ3dst",
    });
    const trader = buildTraderActivityEmail({
      event: "date_request",
      customerName: "Jessica Walker",
      jobTitle: "Garden makeover",
      preview: "Could we move the date to Friday?",
      proposalId: "proposal-1",
    });
    expectDarkShell(customer.html, { businessName: "Carter &amp; Sons Kitchens" });
    expectDarkShell(trader.html, { trader: true });
    expect(customer.heading).toBe("New date proposed");
    expect(customer.subject).toBe("Booking update from Carter & Sons Kitchens");
    expect(customer.html).toContain("Previous date");
    expect(customer.html).toContain("New proposed date");
    expect(customer.ctaLabel).toBe("Confirm date");
    expect(trader.subject).toBe("Jessica Walker requested another date");
  });

  it("uses the dark shell for customer acceptance notifications", () => {
    const customer = buildBookingConfirmationEmailHtml({
      businessName: "Carter & Sons Kitchens",
      customerName: "Emma Whitfield",
      portalUrl,
      title: "Bathroom renovation",
      plannedStartDate: "2026-09-18",
      plannedStartTime: "09:00",
      estimatedDuration: "5 days",
    });
    const trader = buildTraderActivityEmail({
      event: "accepted",
      customerName: "Jessica Walker",
      jobTitle: "Garden makeover",
      preview: "Customer accepted the proposal",
      proposalId: "proposal-1",
    });
    expectDarkShell(customer);
    expectDarkShell(trader.html, { trader: true });
    expect(trader.subject).toBe("Jessica Walker accepted your proposal");
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("sendCustomerBookingConfirmation");
    expect(actions).toContain("buildBookingConfirmationEmail");
  });

  it("uses the dark shell for customer decline notification content", () => {
    const trader = buildTraderActivityEmail({
      event: "declined",
      customerName: "Jessica Walker",
      jobTitle: "Garden makeover",
      preview: "Customer declined the proposal",
      proposalId: "proposal-1",
    });
    expectDarkShell(trader.html, { trader: true });
    expect(trader.subject).toBe("Jessica Walker declined your proposal");
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    const declineStart = actions.indexOf(
      "export async function declinePublicProposal"
    );
    const declineEnd = actions.indexOf(
      "export async function holdPublicAvailabilitySlot"
    );
    const declineFn = actions.slice(declineStart, declineEnd);
    expect(declineFn).toContain("status: \"declined\"");
    expect(declineFn).not.toContain("sendNotificationEmail");
    expect(declineFn).not.toContain("notifyConversationParticipant");
  });

  it("does not use a white page background on any current transactional HTML email", () => {
    const emails = [
      buildProposalEmailHtml({
        businessName: "Carter & Sons Kitchens",
        portalUrl,
        title: "Kitchen installation",
      }),
      buildBookingConfirmationEmailHtml({
        businessName: "Carter & Sons Kitchens",
        portalUrl,
        title: "Bathroom renovation",
      }),
      buildVisitBookingEmail({
        visit: sampleVisit(),
        businessName: "Carter & Sons Kitchens",
        ctaUrl: "https://app.reanvil.com/",
      }).html,
      buildTraderActivityEmail({
        customerName: "Jessica Walker",
        preview: "Hello",
        proposalId: "proposal-1",
      }).html,
      buildCustomerReplyEmail({
        businessName: "Carter & Sons Kitchens",
        customerName: "Jessica",
        preview: "Hello",
        portalToken: "token",
      }).html,
      buildCustomerDateProposedEmail({
        businessName: "Carter & Sons Kitchens",
        customerName: "Emma",
        slotLabel: "Friday",
        portalToken: "token",
      }).html,
      buildCustomerScheduleUpdateEmail({
        businessName: "Carter & Sons Kitchens",
        customerName: "Emma",
        scheduleLabel: "Friday 18 September",
        confirmed: true,
        portalToken: "token",
      }).html,
      buildNotificationHtml({
        to: "a@example.com",
        subject: "Update",
        message: "Hello",
        businessName: "Carter & Sons Kitchens",
        ctaUrl: portalUrl,
        ctaLabel: "Open secure portal",
      }),
    ];
    for (const html of emails) {
      expect(html).toContain("#08080a");
      expect(html).not.toMatch(/<body[^>]*background:\s*#(?:fff|ffffff|f5f5f5)/i);
    }
    const notificationSource = readFileSync(
      join(process.cwd(), "lib/email/send-notification-email.ts"),
      "utf8"
    );
    expect(notificationSource).not.toContain("background:#111111");
    expect(notificationSource).not.toContain("color: #111111");
    expect(notificationSource).not.toContain("light-theme");
  });

  it("never leaks Your Business and shows the real business name on customer emails", () => {
    const html = renderCustomerEmail({
      businessName: "Carter & Sons Kitchens",
      heading: "Booking confirmed",
      intro: "Your booking is confirmed.",
      ctaLabel: "View booking",
      ctaUrl: portalUrl,
      preheader: "Your booking has been confirmed.",
    });
    expect(html).toContain("Carter &amp; Sons Kitchens");
    expect(html).not.toMatch(/Your Business/i);
    const placeholder = renderCustomerEmail({
      businessName: "Your Business",
      heading: "Booking confirmed",
      intro: "Your booking is confirmed.",
      ctaLabel: "View booking",
      ctaUrl: portalUrl,
      preheader: "Your booking has been confirmed.",
    });
    expect(placeholder).not.toMatch(/Your Business/i);
  });

  it("renders a logo when a real URL exists and falls back cleanly when missing", () => {
    const withLogo = renderCustomerEmail({
      businessName: "Carter & Sons Kitchens",
      logoUrl: "https://cdn.example.com/carter-logo.png",
      heading: "Booking confirmed",
      intro: "Your booking is confirmed.",
      ctaLabel: "View booking",
      ctaUrl: portalUrl,
      preheader: "Your booking has been confirmed.",
    });
    const withoutLogo = renderCustomerEmail({
      businessName: "Carter & Sons Kitchens",
      heading: "Booking confirmed",
      intro: "Your booking is confirmed.",
      ctaLabel: "View booking",
      ctaUrl: portalUrl,
      preheader: "Your booking has been confirmed.",
    });
    expect(withLogo).toContain('src="https://cdn.example.com/carter-logo.png"');
    expect(withoutLogo).not.toContain("<img");
    expect(withoutLogo).toContain("REANVIL");
    expect(
      renderCustomerEmail({
        businessName: "Carter & Sons Kitchens",
        logoUrl: "javascript:alert(1)",
        heading: "Hello",
        intro: "Hello",
        ctaLabel: "Open",
        ctaUrl: portalUrl,
        preheader: "Hello",
      })
    ).not.toContain("<img");
    expect(WORKSPACE_HAS_PERSISTED_LOGO).toBe(false);
  });

  it("reuses the orange CTA and shared footer", () => {
    const customer = renderCustomerEmail({
      businessName: "Carter & Sons Kitchens",
      heading: "You have a new message",
      intro: "Carter & Sons Kitchens has replied to you.",
      ctaLabel: "View message",
      ctaUrl: portalUrl,
      preheader: "You have a new message.",
    });
    const trader = renderTraderEmail({
      heading: "New customer message",
      intro: "Jessica Walker has sent you a message.",
      ctaLabel: "Open conversation",
      ctaUrl: traderUrl,
      preheader: "You have a new customer message.",
    });
    expect(customer).toContain(`background:${CUSTOMER_EMAIL_COLORS.accent}`);
    expect(customer).toContain("View message");
    expect(customer).toContain("Powered by Reanvil");
    expect(customer).toContain("secure customer portal");
    expect(trader).toContain(`background:${CUSTOMER_EMAIL_COLORS.accent}`);
    expect(trader).toContain("Secure Reanvil notification");
  });

  it("does not print raw portal token URLs in HTML and keeps plain-text URLs", () => {
    const email = buildCustomerReplyEmail({
      businessName: "Carter & Sons Kitchens",
      customerName: "Jessica Walker",
      preview: "Friday works.",
      portalToken: "CEcHRg2ZMCSLkHZS5SqQ3dst",
    });
    expect(htmlProminentlyShowsPortalUrl(email.html)).toBe(false);
    expect(email.html).not.toContain("Or paste this link");
    expect(email.html).toContain("View message");
    expect(email.text).toContain("/p/CEcHRg2ZMCSLkHZS5SqQ3dst");
    expect(stripVisibleEmailUrls(`See ${portalUrl} now`)).not.toContain("http");
  });

  it("uses event-appropriate subjects and concise hidden preheaders", () => {
    const visit = buildVisitBookingEmail({
      visit: sampleVisit({
        enquiry_summary:
          "A very long job description that must never become the inbox preview text for this customer visit booking notification email",
      }),
      businessName: "Carter & Sons Kitchens",
      ctaUrl: "https://app.reanvil.com/",
    });
    expect(visit.subject).not.toContain("Your proposal is ready");
    expect(visit.preheader).toBe("Your visit has been booked.");
    expect(visit.preheader.length).toBeLessThan(90);
    expect(visit.html).toContain("display:none");
    expect(visit.html).toContain(visit.preheader);
  });

  it("uses the same templates for Send and Resend", () => {
    const sendHtml = buildProposalSendHtml({
      to: "emma@example.com",
      subject: "Proposal from Carter & Sons Kitchens",
      message: `View your proposal:\n${portalUrl}`,
      pdfBuffer: Buffer.from("%PDF-1.4"),
      businessName: "Carter & Sons Kitchens",
      ctaUrl: portalUrl,
      title: "Kitchen installation",
    });
    const resendHtml = buildProposalSendHtml({
      to: "emma@example.com",
      subject: "Proposal from Carter & Sons Kitchens",
      message: `View your proposal:\n${portalUrl}`,
      pdfBuffer: Buffer.from("%PDF-1.4"),
      businessName: "Carter & Sons Kitchens",
      ctaUrl: portalUrl,
      title: "Kitchen installation",
    });
    expect(sendHtml).toBe(resendHtml);
    const notificationA = buildNotificationHtml({
      to: "trader@example.com",
      subject: "New message from Jessica Walker",
      message: "Jessica Walker has sent you a message.",
      businessName: "Reanvil",
      ctaUrl: traderUrl,
      ctaLabel: "Open conversation",
      audience: "trader",
      heading: "New customer message",
      preheader: "You have a new customer message.",
    });
    const notificationB = buildNotificationHtml({
      to: "trader@example.com",
      subject: "New message from Jessica Walker",
      message: "Jessica Walker has sent you a message.",
      businessName: "Reanvil",
      ctaUrl: traderUrl,
      ctaLabel: "Open conversation",
      audience: "trader",
      heading: "New customer message",
      preheader: "You have a new customer message.",
    });
    expect(notificationA).toBe(notificationB);
    expect(notificationA).toContain("#08080a");
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("html: email.html");
    expect(actions).toContain("buildBookingConfirmationEmail");
  });

  it("does not change recipients or trigger conditions in senders", () => {
    const visitNotify = readFileSync(
      join(process.cwd(), "lib/visits/notify.ts"),
      "utf8"
    );
    const portalActions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(visitNotify).toContain("input.visit.contact_email");
    expect(portalActions).toContain("loaded.proposal.customer_email");
    expect(portalActions).toContain("loaded.workspace.contact_email");
    expect(portalActions).toContain("sendCustomerBookingConfirmation");
    expect(portalActions).toContain("declinePublicProposal");
  });

  it("covers the future shared-shell API so new emails only supply content", () => {
    const html = renderCustomerEmail({
      businessName: "Future Trade Co",
      heading: "Invoice ready",
      greeting: "Hi Emma,",
      intro: "Your invoice is ready to view.",
      summaryRows: [{ label: "Amount", value: "£250.00" }],
      ctaLabel: "View invoice",
      ctaUrl: portalUrl,
      supportText: "Pay through the secure portal.",
      preheader: "Your invoice is ready.",
    });
    expectDarkShell(html, { businessName: "Future Trade Co" });
    expect(html).toContain("Invoice ready");
    expect(html).toContain("£250.00");
    expect(html).toContain("View invoice");
    expect(htmlProminentlyShowsPortalUrl(html)).toBe(false);
    expect(html).toContain(`href="${portalUrl}"`);
  });
});
