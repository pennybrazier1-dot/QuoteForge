import { describe, expect, it } from "vitest";
import { buildProposalEmailHtml } from "@/lib/email/proposal-email-html";
import { buildProposalEmailCopy } from "@/lib/proposals/proposal-email-delivery";
import {
  buildCustomerProposalPdfUrl,
  buildCustomerProposalPortalUrl,
} from "@/lib/proposals/customer-portal/token";

const portalUrl = "https://app.reanvil.com/p/secureToken123";
const pdfUrl = "https://app.reanvil.com/p/secureToken123/pdf";

describe("branded proposal email", () => {
  const html = buildProposalEmailHtml({
    businessName: "Carter & Sons Kitchens",
    introHtml: "Your proposal from Carter &amp; Sons Kitchens is ready.",
    portalUrl,
    pdfUrl,
    title: "Kitchen installation",
    priceLabel: "£8,500",
    proposedDateLabel: "12 August · 10:30",
    scopeSummary: "Supply and fit a new kitchen.",
  });

  it("contains the trader business name as the hero", () => {
    expect(html).toContain("Carter &amp; Sons Kitchens");
    expect(html).toMatch(/Your proposal is ready/);
    expect(html.indexOf("Carter &amp; Sons Kitchens")).toBeLessThan(
      html.indexOf("Powered by Reanvil")
    );
  });

  it("contains the portal View proposal CTA", () => {
    expect(html).toContain("View proposal");
    expect(html).toContain(`href="${portalUrl}"`);
  });

  it("preserves the same secure portal link", () => {
    expect(html).toContain(portalUrl);
    expect(buildCustomerProposalPortalUrl("secureToken123")).toMatch(
      /\/p\/secureToken123$/
    );
  });

  it("keeps the PDF download link available", () => {
    expect(html).toContain("Download PDF");
    expect(html).toContain(pdfUrl);
    expect(buildCustomerProposalPdfUrl("secureToken123")).toMatch(
      /\/p\/secureToken123\/pdf$/
    );
  });

  it("does not render a broken logo when none exists", () => {
    expect(html).not.toContain("<img");
  });

  it("renders a logo image when a URL is available", () => {
    const withLogo = buildProposalEmailHtml({
      businessName: "Carter & Sons Kitchens",
      businessLogoUrl: "https://cdn.example.com/logo.png",
      introHtml: "Ready",
      portalUrl,
    });
    expect(withLogo).toContain(
      'src="https://cdn.example.com/logo.png"'
    );
  });

  it("keeps the same portal URL in the plain-text fallback", () => {
    const copy = buildProposalEmailCopy({
      customerName: "Michael Carter",
      businessName: "Carter & Sons Kitchens",
      portalUrl,
    });
    expect(copy.subject).toContain("Carter & Sons Kitchens");
    expect(copy.message).toContain(portalUrl);
    expect(copy.message).toMatch(/PDF/);
    expect(copy.message).toContain("View your proposal:");
  });
});
