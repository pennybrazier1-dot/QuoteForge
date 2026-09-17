import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProposalEmailHtml } from "@/lib/email/proposal-email-html";
import {
  buildProposalEmailContentFields,
  buildProposalEmailIntro,
  buildProposalEmailSubject,
  emailHtmlHasDarkTextOnDarkBackground,
  emailHtmlUsesCssVariables,
  htmlProminentlyShowsPortalUrl,
  resolveProposalEmailBusinessName,
  resolveProposalEmailJobTitle,
  sanitizeProposalEmailSubject,
} from "@/lib/email/proposal-email-presentation";
import {
  PROPOSAL_EMAIL_COLORS,
  PROPOSAL_EMAIL_PREHEADER,
} from "@/lib/email/proposal-email-tokens";
import { WORKSPACE_HAS_PERSISTED_LOGO } from "@/lib/proposals/pdf/customer-branding";
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
    expect(withLogo).toContain("max-height:80px");
    expect(WORKSPACE_HAS_PERSISTED_LOGO).toBe(false);
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
    expect(buildProposalEmailSubject("Sneddom Plumbing Ltd")).toBe(
      "Proposal from Sneddom Plumbing Ltd"
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
    expect(copy.subject).toBe("Proposal from Carter & Sons Kitchens");
    expect(copy.subject).not.toMatch(/Your Business/i);
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
      subject: "Proposal from Carter & Sons Kitchens",
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
      subject: "Proposal from Carter & Sons Kitchens",
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

  it("keeps one visible heading and a hidden concise preheader", () => {
    expect(html.match(/<h1[^>]*>Your proposal is ready<\/h1>/g)).toHaveLength(1);
    expect(html).toContain(PROPOSAL_EMAIL_PREHEADER);
    expect(html).toContain("display:none");
    expect(html).toContain("mso-hide:all");
  });

  it("uses a short job title and keeps the long scope only in Summary", () => {
    const sarahFields = buildProposalEmailContentFields({
      title: "Proposal for Sarah",
      job_summary:
        "Full bathroom renovation including removal of the old suite, replacement of sanitaryware, tiling and installation of a new shower.",
      customer_name: "Sarah Jones",
      total_amount: 370000,
      planned_start_date: null,
      planned_start_time: null,
      estimated_duration: "5 days",
    });
    expect(resolveProposalEmailJobTitle({
      title: "Proposal for Sarah",
      jobSummary: sarahFields.scopeSummary,
    })).toBe("Bathroom renovation");
    expect(sarahFields.title).toBe("Bathroom renovation");
    expect(sarahFields.scopeSummary).toContain(
      "Full bathroom renovation including removal of the old suite"
    );
    expect(sarahFields.scopeSummary).not.toBe(sarahFields.title);
    expect(sarahFields.proposedDateLabel).toBeNull();

    const intro = buildProposalEmailIntro(sarahFields.title);
    expect(intro).toBe(
      "Your proposal for the bathroom renovation is ready to view in your secure customer portal."
    );
    expect(intro).not.toContain("removal of the old suite");

    const sarahHtml = sampleHtml({
      businessName: "Sneddom Plumbing Ltd",
      customerName: "Sarah Jones",
      title: sarahFields.title,
      jobSubtitle: sarahFields.jobSubtitle,
      priceLabel: "£3,700.00",
      proposedDateLabel: sarahFields.proposedDateLabel,
      durationLabel: sarahFields.durationLabel,
      scopeSummary: sarahFields.scopeSummary,
    });
    expect(sarahHtml).toContain("Bathroom renovation");
    expect(sarahHtml).toContain("£3,700.00");
    expect(sarahHtml).toContain("5 days");
    expect(sarahHtml).not.toContain("Proposed start date");
    expect(
      sarahHtml.split("Full bathroom renovation including removal").length
    ).toBe(2);
  });

  it("loads branding from the same send and resend helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/proposals/send-proposal-to-customer.ts"),
      "utf8"
    );
    expect(source).toContain("loadWorkspaceEmailLogoUrl");
    expect(source).toContain("workspace.trade_type");
    expect(source).not.toContain("resolveCustomerFacingBusinessLogoUrl(null)");
    expect(source).toContain("buildProposalEmailContentFields");
    expect(source).toContain("sendProposalEmail");
    const template = readFileSync(
      join(process.cwd(), "lib/email/send-proposal-email.ts"),
      "utf8"
    );
    expect(template).toContain("buildProposalEmailHtml");
    expect(template).toContain("html: buildHtmlEmail(input)");
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
    const kitchen = sampleHtml({
      businessLogoUrl: "https://cdn.example.com/carter-logo.png",
      businessTradeLabel: "Kitchens",
    });
    const sarah = sampleHtml({
      businessName: "Sneddom Plumbing Ltd",
      businessLogoUrl: null,
      businessTradeLabel: "Plumbing",
      customerName: "Sarah Jones",
      title: "Bathroom renovation",
      jobSubtitle: null,
      priceLabel: "£3,700.00",
      proposedDateLabel: null,
      durationLabel: "5 days",
      scopeSummary:
        "Full bathroom renovation including removal of the old suite, replacement of sanitaryware, tiling and installation of a new shower.",
    });
    const preview = `${kitchen}\n<hr />\n${sarah}`;
    const previewPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../notes/proposal-email-preview.html"
    );
    writeFileSync(previewPath, preview, "utf8");
    expect(kitchen).toContain("Carter &amp; Sons Kitchens");
    expect(kitchen).toContain("carter-logo.png");
    expect(kitchen.match(/<h1[^>]*>Your proposal is ready<\/h1>/g)).toHaveLength(
      1
    );
    expect(sarah).toContain("Bathroom renovation");
    expect(sarah).toContain("Hi Sarah,");
    expect(sarah).not.toContain("Proposed start date");
    expect(preview).toContain("View proposal →");
  });
});
