import { describe, expect, it } from "vitest";
import {
  buildCustomerConversationUrl,
  buildCustomerReplyNotification,
  buildTraderConversationUrl,
  buildTraderMessageNotification,
} from "@/lib/proposals/customer-portal/conversation-notify";
import { CUSTOMER_EMAIL_COLORS } from "@/lib/email/customer-email-tokens";

describe("conversation notifications", () => {
  it("builds customer-facing reply notification with portal CTA and dark shell", () => {
    const note = buildCustomerReplyNotification({
      businessName: "Bright Bathrooms",
      customerName: "Alex",
      preview: "We can do Friday morning.",
      portalToken: "abc123token",
    });

    expect(note.subject).toBe("New message from Bright Bathrooms");
    expect(note.message).toContain("We can do Friday morning.");
    expect(note.ctaUrl).toBe(buildCustomerConversationUrl("abc123token"));
    expect(note.ctaLabel).toBe("View message");
    expect(note.html).toContain("#08080a");
    expect(note.html).toContain("You have a new message");
    expect(note.html).toContain(`background:${CUSTOMER_EMAIL_COLORS.accent}`);
    expect(note.html).not.toMatch(/Your Business/i);
  });

  it("builds trader-facing message notification with proposal CTA and dark shell", () => {
    const note = buildTraderMessageNotification({
      businessName: "Bright Bathrooms",
      customerName: "Alex",
      proposalNumber: "PROP-12",
      preview: "Can we change the tiles?",
      proposalId: "proposal-1",
      kindLabel: "change request",
      jobTitle: "Bathroom renovation",
    });

    expect(note.subject).toBe("Alex requested a change");
    expect(note.ctaUrl).toBe(buildTraderConversationUrl("proposal-1"));
    expect(note.message).toContain("Can we change the tiles?");
    expect(note.html).toContain("REANVIL");
    expect(note.html).toContain("#08080a");
    expect(note.html).toContain("Bathroom renovation");
    expect(note.heading).toBe("Customer requested a change");
  });
});
