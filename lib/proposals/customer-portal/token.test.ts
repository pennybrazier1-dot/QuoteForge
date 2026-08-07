import { describe, expect, it } from "vitest";
import {
  buildCustomerProposalPortalPath,
  buildCustomerProposalPortalUrl,
  createCustomerAccessToken,
} from "@/lib/proposals/customer-portal/token";
import { buildSendProposalMessage } from "@/lib/proposals/send-proposal-defaults";

describe("customer proposal portal helpers", () => {
  it("creates a long opaque access token", () => {
    const token = createCustomerAccessToken();
    expect(token.length).toBe(32);
    expect(token).toMatch(/^[A-Za-z0-9]+$/);
    expect(createCustomerAccessToken()).not.toBe(token);
  });

  it("builds portal paths and urls", () => {
    expect(buildCustomerProposalPortalPath("abc123")).toBe("/p/abc123");
    expect(buildCustomerProposalPortalUrl("abc123")).toMatch(/\/p\/abc123$/);
  });

  it("includes the respond link in the default email message", () => {
    const message = buildSendProposalMessage(
      "Alex",
      "Bright Bathrooms",
      "https://example.com/p/token123"
    );

    expect(message).toContain("View & respond to your proposal:");
    expect(message).toContain("https://example.com/p/token123");
    expect(message).toContain("PDF copy is also attached");
  });
});
