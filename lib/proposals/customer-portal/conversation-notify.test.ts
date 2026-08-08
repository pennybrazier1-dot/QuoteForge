import { describe, expect, it } from "vitest";
import {
  buildCustomerConversationUrl,
  buildCustomerReplyNotification,
  buildTraderConversationUrl,
  buildTraderMessageNotification,
} from "@/lib/proposals/customer-portal/conversation-notify";

describe("conversation notifications", () => {
  it("builds customer-facing reply notification with portal CTA", () => {
    const note = buildCustomerReplyNotification({
      businessName: "Bright Bathrooms",
      customerName: "Alex",
      preview: "We can do Friday morning.",
      portalToken: "abc123token",
    });

    expect(note.subject).toContain("replied");
    expect(note.message).toContain("We can do Friday morning.");
    expect(note.ctaUrl).toBe(buildCustomerConversationUrl("abc123token"));
    expect(note.ctaLabel).toBe("View conversation");
  });

  it("builds trader-facing message notification with proposal CTA", () => {
    const note = buildTraderMessageNotification({
      businessName: "Bright Bathrooms",
      customerName: "Alex",
      proposalNumber: "PROP-12",
      preview: "Can we change the tiles?",
      proposalId: "proposal-1",
      kindLabel: "change request",
    });

    expect(note.subject).toContain("Alex");
    expect(note.ctaUrl).toBe(buildTraderConversationUrl("proposal-1"));
    expect(note.message).toContain("Can we change the tiles?");
  });
});
