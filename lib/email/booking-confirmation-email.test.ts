import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildBookingConfirmationEmail,
  buildBookingConfirmationEmailHtml,
  buildBookingConfirmationEmailSubject,
  formatBookingEmailDate,
} from "@/lib/email/booking-confirmation-email";
import { buildProposalEmailHtml } from "@/lib/email/proposal-email-html";
import {
  emailHtmlHasDarkTextOnDarkBackground,
  emailHtmlUsesCssVariables,
  htmlProminentlyShowsPortalUrl,
  resolveProposalEmailBusinessName,
} from "@/lib/email/proposal-email-presentation";
import {
  BOOKING_EMAIL_CTA_LABEL,
  BOOKING_EMAIL_FALLBACK_LINK_LABEL,
  CUSTOMER_EMAIL_COLORS,
} from "@/lib/email/customer-email-tokens";
import { PROPOSAL_EMAIL_COLORS } from "@/lib/email/proposal-email-tokens";
import { WORKSPACE_HAS_PERSISTED_LOGO } from "@/lib/proposals/pdf/customer-branding";
import { buildCustomerProposalPortalUrl } from "@/lib/proposals/customer-portal/token";

const portalUrl = "https://app.reanvil.com/p/CEcHRg2ZMCSLkHZS5SqQ3dst";

const sampleInput = {
  businessName: "Carter & Sons Kitchens",
  customerName: "Emma Whitfield",
  portalUrl,
  title: "Bathroom renovation",
  plannedStartDate: "2026-09-18",
  plannedStartTime: "09:00",
  estimatedDuration: "5 days",
};

function sampleHtml(
  overrides: Partial<Parameters<typeof buildBookingConfirmationEmailHtml>[0]> = {}
) {
  return buildBookingConfirmationEmailHtml({ ...sampleInput, ...overrides });
}

describe("booking confirmation email", () => {
  const email = buildBookingConfirmationEmail(sampleInput);
  const html = email.html;

  it("uses the shared dark Reanvil page background", () => {
    expect(html).toContain(`background:${CUSTOMER_EMAIL_COLORS.page}`);
    expect(html).toContain("#08080a");
    expect(emailHtmlHasDarkTextOnDarkBackground(html)).toBe(false);
  });

  it("uses a charcoal summary card with an orange border", () => {
    expect(html).toContain(`background:${CUSTOMER_EMAIL_COLORS.card}`);
    expect(html).toContain("#111114");
    expect(html).toContain(`border:2px solid ${CUSTOMER_EMAIL_COLORS.accent}`);
    expect(html).toContain("#ff6a1a");
  });

  it("shows the real business name and never Your Business", () => {
    expect(html).toContain("Carter &amp; Sons Kitchens");
    expect(resolveProposalEmailBusinessName("Carter & Sons Kitchens")).toBe(
      "Carter & Sons Kitchens"
    );
    expect(html).not.toMatch(/Your Business/i);
    expect(sampleHtml({ businessName: "Your Business" })).not.toMatch(
      /Your Business/i
    );
    expect(sampleHtml({ businessName: "Reanvil Admin Testing" })).not.toMatch(
      /Your Business/i
    );
  });

  it("renders a logo when a real URL exists and falls back to the business name", () => {
    const withLogo = sampleHtml({
      businessLogoUrl: "https://cdn.example.com/carter-logo.png",
    });
    expect(withLogo).toContain('src="https://cdn.example.com/carter-logo.png"');
    expect(withLogo).toContain("max-height:80px");
    expect(html).not.toContain("<img");
    expect(sampleHtml({ businessLogoUrl: "javascript:alert(1)" })).not.toContain(
      "<img"
    );
    expect(WORKSPACE_HAS_PERSISTED_LOGO).toBe(false);
  });

  it("renders booking date and time correctly", () => {
    expect(formatBookingEmailDate({ dateIso: "2026-09-18" })).toBe(
      "Friday 18 September 2026"
    );
    expect(html).toContain("Friday 18 September 2026");
    expect(html).toContain("09:00");
    expect(html).toContain("Bathroom renovation");
    expect(html).toContain("5 days");
  });

  it("points the CTA at the existing secure portal URL", () => {
    expect(html).toContain(BOOKING_EMAIL_CTA_LABEL);
    expect(html).toContain(`href="${portalUrl}"`);
    expect(html).toContain(BOOKING_EMAIL_FALLBACK_LINK_LABEL);
    expect(buildCustomerProposalPortalUrl("secureToken123")).toMatch(
      /\/p\/secureToken123$/
    );
  });

  it("does not print the raw token URL in the HTML", () => {
    expect(htmlProminentlyShowsPortalUrl(html)).toBe(false);
    expect(html).not.toContain("Or paste this link");
    expect(html).not.toMatch(/>\s*https?:\/\/[^<]*\/p\/[A-Za-z0-9_-]+/i);
  });

  it("keeps a usable URL in the plain-text fallback", () => {
    expect(email.text).toContain(portalUrl);
    expect(email.text).toContain("Hi Emma,");
    expect(email.text).toContain(
      "Your booking with Carter & Sons Kitchens is confirmed."
    );
    expect(email.text).toContain("Friday 18 September 2026");
    expect(email.text).toContain("09:00");
  });

  it("uses the real business name in the subject", () => {
    expect(email.subject).toBe("Booking confirmed with Carter & Sons Kitchens");
    expect(buildBookingConfirmationEmailSubject("Your Business")).toBe(
      "Booking confirmed"
    );
    expect(buildBookingConfirmationEmailSubject("")).toBe("Booking confirmed");
    expect(buildBookingConfirmationEmailSubject("Your Business")).not.toMatch(
      /Your Business/i
    );
  });

  it("reuses the same visual tokens and shell as the proposal email", () => {
    expect(PROPOSAL_EMAIL_COLORS).toBe(CUSTOMER_EMAIL_COLORS);
    const proposalHtml = buildProposalEmailHtml({
      businessName: "Carter & Sons Kitchens",
      customerName: "Emma Whitfield",
      portalUrl,
      title: "Bathroom renovation",
    });
    expect(html).toContain(`background:${PROPOSAL_EMAIL_COLORS.page}`);
    expect(proposalHtml).toContain(`background:${PROPOSAL_EMAIL_COLORS.page}`);
    expect(html).toContain("Powered by Reanvil");
    expect(proposalHtml).toContain("Powered by Reanvil");
    expect(html).toContain("role=\"presentation\"");
    expect(emailHtmlUsesCssVariables(html)).toBe(false);
    expect(html).toContain('name="color-scheme" content="dark"');
    expect(html).toContain("max-width:600px");
    const sendSource = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(sendSource).toContain("buildBookingConfirmationEmail");
    expect(sendSource).toContain("loadWorkspaceEmailLogoUrl");
    expect(sendSource).toContain("html: email.html");
    expect(sendSource).not.toContain("Booking confirmed –");
  });

  it("does not change booking or proposal lifecycle logic when only rendering", () => {
    const before = {
      status: "booked",
      accepted_at: "2026-09-17T10:00:00.000Z",
      customer_access_token: "existingToken",
    };
    sampleHtml();
    expect(before).toEqual({
      status: "booked",
      accepted_at: "2026-09-17T10:00:00.000Z",
      customer_access_token: "existingToken",
    });
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("ensureJobForAcceptedProposal");
    expect(actions).toContain("promoteBookedJobIfReady");
    expect(actions).toContain("buildCustomerProposalPortalUrl(loaded.view.token)");
  });

  it("writes a local HTML preview for visual review", () => {
    const withLogo = sampleHtml({
      businessLogoUrl: "https://cdn.example.com/carter-logo.png",
      businessTradeLabel: "Kitchens",
    });
    const previewPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../notes/booking-confirmation-email-preview.html"
    );
    writeFileSync(previewPath, withLogo, "utf8");
    expect(withLogo).toContain("Booking confirmed");
    expect(withLogo).toContain("carter-logo.png");
  });
});
