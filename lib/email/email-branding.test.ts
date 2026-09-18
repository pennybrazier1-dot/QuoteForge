import { describe, expect, it } from "vitest";
import {
  customerMessageSenderCopy,
  hasRealBusinessLogo,
  REANVIL_EMAIL_BRAND_NAME,
  resolveEmailBrandIdentity,
} from "@/lib/email/email-branding";
import { buildCustomerReplyEmail } from "@/lib/email/transactional-events";
import { CUSTOMER_EMAIL_COLORS } from "@/lib/email/customer-email-tokens";
import { WORKSPACE_HAS_PERSISTED_LOGO } from "@/lib/proposals/pdf/customer-branding";

describe("shared email branding fallback", () => {
  it("uses Reanvil when the trader has no uploaded logo", () => {
    const brand = resolveEmailBrandIdentity({
      businessName: "Penny's Decorating",
    });
    expect(brand.mode).toBe("reanvil");
    expect(brand.logoUrl).toBeNull();
    expect(brand.brandName).toBe(REANVIL_EMAIL_BRAND_NAME);
    expect(brand.businessName).toBe("Penny's Decorating");
    expect(hasRealBusinessLogo(null)).toBe(false);
    expect(WORKSPACE_HAS_PERSISTED_LOGO).toBe(false);
  });

  it("uses the real trader logo when one exists", () => {
    const brand = resolveEmailBrandIdentity({
      businessName: "Penny's Decorating",
      logoUrl: "https://cdn.example.com/penny-logo.png",
    });
    expect(brand.mode).toBe("trader");
    expect(brand.logoUrl).toBe("https://cdn.example.com/penny-logo.png");
    expect(hasRealBusinessLogo("https://cdn.example.com/penny-logo.png")).toBe(
      true
    );
  });
});

describe("customer message email copy", () => {
  it("uses a real business name and one main heading", () => {
    const email = buildCustomerReplyEmail({
      businessName: "Penny's Decorating",
      customerName: "Emma Whitfield",
      preview: "Sorry, I'm running a little late, I'm stuck in traffic.",
      portalToken: "CEcHRg2ZMCSLkHZS5SqQ3dst",
      jobTitle: "Garden makeover",
    });

    expect(email.heading).toBe("You have a new message");
    expect(email.subject).toBe("New message from Penny's Decorating");
    expect(email.preheader).toBe("You have a new message in Reanvil.");
    expect(email.html).toContain("Penny&#39;s Decorating has sent you a message.");
    expect(email.html).toContain("Sorry, I&#39;m running a little late, I&#39;m stuck in traffic.");
    expect(email.html).toContain("Regarding: Garden makeover");
    expect(email.html).toContain("View message");
    expect(email.html).toContain("REANVIL");
    expect(email.html).toContain(CUSTOMER_EMAIL_COLORS.page);
    expect(email.html).toContain("#08080a");
    expect(email.html).toContain("#111114");
    expect(email.html).toContain("#ff6a1a");
    expect(email.html).not.toMatch(/Your Business/i);
    expect(email.ctaUrl).toContain("view=conversation");
    expect(email.ctaUrl).toContain("#proposal-conversation");

    const headingHits = email.html.match(/<h1[^>]*>You have a new message<\/h1>/g) ?? [];
    expect(headingHits).toHaveLength(1);
    expect(email.html).not.toMatch(/<h1[^>]*>You have a new message<\/h1>[\s\S]*<h1[^>]*>You have a new message<\/h1>/);
    expect(email.html).toContain("has sent you a message");
    expect(email.html).not.toMatch(/Hi Emma,[\s\S]*You have a new message/);
  });

  it("falls back to Your trader when no business name exists", () => {
    expect(customerMessageSenderCopy(null)).toBe(
      "Your trader has sent you a message."
    );
    const email = buildCustomerReplyEmail({
      businessName: null,
      customerName: "Emma Whitfield",
      preview: "See you soon.",
      portalToken: "token-1",
    });
    expect(email.subject).toBe("You have a new message");
    expect(email.html).toContain("Your trader has sent you a message.");
    expect(email.html).toContain("REANVIL");
    expect(email.html).not.toMatch(/Your Business/i);
  });

  it("still prefers a real logo over the Reanvil fallback", () => {
    const email = buildCustomerReplyEmail({
      businessName: "Penny's Decorating",
      customerName: "Emma",
      preview: "On my way.",
      portalToken: "token-1",
      logoUrl: "https://cdn.example.com/penny-logo.png",
    });
    expect(email.html).toContain('src="https://cdn.example.com/penny-logo.png"');
  });
});
