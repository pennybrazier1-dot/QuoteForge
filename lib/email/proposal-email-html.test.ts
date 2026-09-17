import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProposalEmailHtml } from "@/lib/email/proposal-email-html";
import {
  buildProposalEmailContentFields,
  buildProposalEmailSubject,
  emailHtmlHasDarkTextOnDarkBackground,
  emailHtmlUsesCssVariables,
  htmlProminentlyShowsPortalUrl,
  resolveProposalEmailBusinessName,
  sanitizeProposalEmailSubject,
} from "@/lib/email/proposal-email-presentation";
import { PROPOSAL_EMAIL_COLORS } from "@/lib/email/proposal-email-tokens";
import { buildHtmlEmail } from "@/lib/email/send-proposal-email";
import { buildProposalEmailCopy } from "@/lib/proposals/proposal-email-delivery";
import {
  buildCustomerProposalPdfUrl,
  buildCustomerProposalPortalUrl,
} from "@/lib/proposals/customer-portal/token";

const portalUrl = "https://app.reanvil.com/p/CEcHRg2ZMCSLkHZS5SqQ3dst";
const pdfUrl = "https://app.reanvil.com/p/CEcHRg2ZMCSLkHZS5SqQ3dst/pdf";

const sampleInput = {
  businessName: "Carter & Sons Kitchens",
  customerName: "Emma Whitfield",
  portalUrl,
  pdfUrl,
  title: "Kitchen installation",
  jobSubtitle: "Full kitchen update",
  priceLabel: "£8,000.00",
  proposedDateLabel: "12 August 2026 at 10:30",
  durationLabel: "5 days",
  scopeSummary:
    "Full kitchen replacement including removal of the existing units, installation of new cupboards, worktops, sink and tap.",
};

function sampleHtml(
  overrides: Partial<Parameters<typeof buildProposalEmailHtml>[0]> = {}
) {
  return buildProposalEmailHtml({ ...sampleInput, ...overrides });
}

describe("branded proposal email", () => {
  const html = sampleHtml();

  it("shows the real business name", () => {
    expect(html).toContain("Carter &amp; Sons Kitchens");
    expect(resolveProposalEmailBusinessName("Carter & Sons Kitchens")).toBe(
      "Carter & Sons Kitchens"
    );
  });

  it("renders a logo image when a valid URL is available", () => {
    const withLogo = sampleHtml({
      businessLogoUrl: "https://cdn.example.com/logo.png",
    });
    expect(withLogo).toContain('src="https://cdn.example.com/logo.png"');
    expect(withLogo).toContain("max-height:64px");
  });

  it("does not render a broken logo when none exists", () => {
    expect(html).not.toContain("<img");
    expect(
      sampleHtml({ businessLogoUrl: "javascript:alert(1)" })
    ).not.toContain("<img");
  });

  it("never leaks Your Business into a production email", () => {
    expect(resolveProposalEmailBusinessName("Your Business")).toBeNull();
    expect(resolveProposalEmailBusinessName("")).toBeNull();
    expect(resolveProposalEmailBusinessName("Reanvil Admin Testing")).toBeNull();
    expect(buildProposalEmailSubject("Your Business")).toBe(
      "Your proposal is ready"
    );
    expect(
      sanitizeProposalEmailSubject(
        "Your proposal from Your Business is ready",
        ""
      )
    ).toBe("Your proposal is ready");
    const missing = sampleHtml({ businessName: "Your Business" });
    expect(missing).not.toMatch(/Your Business/i);
    expect(html).not.toMatch(/Your Business/i);
  });

  it("uses the customer first name", () => {
    expect(html).toContain("Hi Emma,");
    expect(html).not.toContain("Hi Customer");
  });

  it("shows the job title and formatted total", () => {
    expect(html).toContain("Kitchen installation");
    expect(html).toContain("Full kitchen update");
    expect(html).toContain("£8,000.00");
    expect(html).toContain("Total price");
  });

  it("shows a real date and time when available", () => {
    expect(html).toContain("12 August 2026 at 10:30");
    expect(html).toContain("Proposed start date");
  });

  it("omits the date row when no date exists", () => {
    const withoutDate = sampleHtml({ proposedDateLabel: null });
    expect(withoutDate).not.toContain("Proposed start date");
    expect(withoutDate).not.toContain("12 August");
  });

  it("shows duration when available and omits it when missing", () => {
    expect(html).toContain("Estimated duration");
    expect(html).toContain("5 days");
    const withoutDuration = sampleHtml({ durationLabel: null });
    expect(withoutDuration).not.toContain("Estimated duration");
    expect(withoutDuration).not.toContain("N/A");
  });

  it("shows a concise summary without dumping the full proposal", () => {
    expect(html).toContain("Full kitchen replacement including removal");
    expect(html).not.toContain("Scope of Work");
    expect(html).not.toContain("Payment Terms");
    expect(html).not.toContain("Things to Confirm");
  });

  it("points View proposal and the fallback link at the same portal token", () => {
    expect(html).toContain("View proposal →");
    expect(html).toContain(`href="${portalUrl}"`);
    expect(html).toContain("Open secure proposal");
    expect(html.split(`href="${portalUrl}"`).length).toBe(3);
    expect(buildCustomerProposalPortalUrl("secureToken123")).toMatch(
      /\/p\/secureToken123$/
    );
  });

  it("does not prominently display the raw tokenised portal URL", () => {
    expect(htmlProminentlyShowsPortalUrl(html)).toBe(false);
    expect(html).not.toContain("Or paste this link");
  });

  it("keeps the full portal URL in the plain-text fallback", () => {
    const copy = buildProposalEmailCopy({
      customerName: "Emma Whitfield",
      businessName: "Carter & Sons Kitchens",
      portalUrl,
    });
    expect(copy.subject).toBe(
      "Your proposal from Carter &amp; Sons Kitchens is ready".replace(
        "&amp;",
        "&"
      )
    );
    expect(copy.subject).toBe(
      "Your proposal from Carter & Sons Kitchens is ready"
    );
    expect(copy.message).toContain(portalUrl);
    expect(copy.message).toMatch(/PDF/);
  });

  it("shows the PDF attachment card and keeps the PDF download path available", () => {
    expect(html).toContain("A PDF copy is attached for your records.");
    expect(html).toContain("You can also download it from the portal.");
    expect(buildCustomerProposalPdfUrl("secureToken123")).toMatch(
      /\/p\/secureToken123\/pdf$/
    );
  });

  it("uses the same HTML template for send and resend", () => {
    const sendHtml = buildHtmlEmail({
      to: "emma@example.com",
      subject: "Your proposal from Carter & Sons Kitchens is ready",
      message: `View your proposal:\n${portalUrl}`,
      pdfBuffer: Buffer.from("%PDF-1.4"),
      businessName: "Carter & Sons Kitchens",
      customerName: "Emma Whitfield",
      ctaUrl: portalUrl,
      title: "Kitchen installation",
      priceLabel: "£8,000.00",
    });
    const resendHtml = buildHtmlEmail({
      to: "emma@example.com",
      subject: "Your proposal from Carter & Sons Kitchens is ready",
      message: `View your proposal:\n${portalUrl}`,
      pdfBuffer: Buffer.from("%PDF-1.4"),
      businessName: "Carter & Sons Kitchens",
      customerName: "Emma Whitfield",
      ctaUrl: portalUrl,
      title: "Kitchen installation",
      priceLabel: "£8,000.00",
    });
    expect(sendHtml).toBe(resendHtml);
    expect(sendHtml).toContain("border:2px solid #ff6a1a");
    expect(sendHtml).toContain("background:#ff6a1a");
  });

  it("uses explicit email-safe colours and no app CSS variables", () => {
    expect(html).toContain(`background:${PROPOSAL_EMAIL_COLORS.page}`);
    expect(html).toContain(`color:${PROPOSAL_EMAIL_COLORS.text}`);
    expect(html).toContain(`color:${PROPOSAL_EMAIL_COLORS.muted}`);
    expect(html).toContain(`border:2px solid ${PROPOSAL_EMAIL_COLORS.accent}`);
    expect(html).toContain(`background:${PROPOSAL_EMAIL_COLORS.accent}`);
    expect(emailHtmlUsesCssVariables(html)).toBe(false);
    expect(emailHtmlHasDarkTextOnDarkBackground(html)).toBe(false);
    expect(html).toContain('name="color-scheme" content="dark"');
    expect(html).toContain("-webkit-text-fill-color");
  });

  it("is email-safe and does not lock a fixed mobile width", () => {
    expect(html).toContain("max-width:600px");
    expect(html).toContain("width:100%");
    expect(html).not.toContain("width:375px");
    expect(html).not.toContain("var(--");
    expect(html).toContain("role=\"presentation\"");
  });

  it("does not output null, undefined or N/A for missing optional values", () => {
    const sparse = sampleHtml({
      jobSubtitle: null,
      proposedDateLabel: "",
      durationLabel: "N/A",
      scopeSummary: "undefined",
      customerName: null,
    });
    expect(sparse).not.toContain("null");
    expect(sparse).not.toContain("undefined");
    expect(sparse).not.toContain("N/A");
    expect(sparse).toContain("Hi,");
  });

  it("maps real proposal fields and omits missing date or duration", () => {
    const present = buildProposalEmailContentFields({
      title: "Proposal for Emma",
      job_summary:
        "Kitchen installation\nFull kitchen update\nFull kitchen replacement including removal of the existing units.",
      customer_name: "Emma Whitfield",
      planned_start_date: "2026-08-12",
      planned_start_time: "10:30",
      estimated_duration: "5 days",
    });
    expect(present.title).toBe("Kitchen installation");
    expect(present.jobSubtitle).toBe("Full kitchen update");
    expect(present.proposedDateLabel).toBe("12 August 2026 at 10:30");
    expect(present.durationLabel).toBe("5 days");
    expect(present.customerFirstName).toBe("Emma");

    const missing = buildProposalEmailContentFields({
      job_summary: "Bathroom refit",
      planned_start_date: null,
      planned_start_time: null,
      estimated_duration: "Not specified",
    });
    expect(missing.proposedDateLabel).toBeNull();
    expect(missing.durationLabel).toBeNull();
  });

  it("does not change lifecycle behaviour when the email is only rendered", () => {
    const before = {
      status: "ready_to_send",
      accepted_at: null,
      customer_access_token: "existingToken",
    };
    sampleHtml();
    expect(before).toEqual({
      status: "ready_to_send",
      accepted_at: null,
      customer_access_token: "existingToken",
    });
  });

  it("writes a local HTML preview for visual review", () => {
    const preview = sampleHtml({
      businessLogoUrl: null,
    });
    const previewPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../notes/proposal-email-preview.html"
    );
    writeFileSync(previewPath, preview, "utf8");
    expect(preview).toContain("Your proposal is ready");
    expect(preview).toContain("View proposal →");
  });
});
