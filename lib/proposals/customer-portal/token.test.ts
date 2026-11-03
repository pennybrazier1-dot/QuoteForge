import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCustomerAccessToken } from "@/lib/proposals/customer-portal/create-customer-access-token";
import {
  buildCustomerProposalPdfPath,
  buildCustomerProposalPdfUrl,
  buildCustomerProposalPortalPath,
  buildCustomerProposalPortalUrl,
} from "@/lib/proposals/customer-portal/token";
import { buildSendProposalMessage } from "@/lib/proposals/send-proposal-defaults";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("customer proposal portal helpers", () => {
  it("creates a long opaque access token on the server module", () => {
    const token = createCustomerAccessToken();
    expect(token.length).toBe(32);
    expect(token).toMatch(/^[A-Za-z0-9]+$/);
    expect(createCustomerAccessToken()).not.toBe(token);
  });

  it("builds portal paths and urls without node:crypto", () => {
    expect(buildCustomerProposalPortalPath("abc123")).toBe("/p/abc123");
    expect(buildCustomerProposalPortalUrl("abc123")).toMatch(/\/p\/abc123$/);
    expect(buildCustomerProposalPdfPath("abc123")).toBe("/p/abc123/pdf");
    expect(buildCustomerProposalPdfUrl("abc123")).toMatch(/\/p\/abc123\/pdf$/);

    const tokenPaths = readRepo("lib/proposals/customer-portal/token.ts");
    expect(tokenPaths).not.toContain("node:crypto");
    expect(tokenPaths).not.toContain("createCustomerAccessToken");
    expect(tokenPaths).not.toContain("randomBytes");
  });

  it("keeps crypto token generation out of the client portal bundle", () => {
    const create = readRepo(
      "lib/proposals/customer-portal/create-customer-access-token.ts"
    );
    expect(create).toContain('from "node:crypto"');
    expect(create).toContain("export function createCustomerAccessToken");

    const ensure = readRepo("lib/proposals/customer-portal/ensure-token.ts");
    expect(ensure).toContain(
      'from "@/lib/proposals/customer-portal/create-customer-access-token"'
    );
    expect(ensure).not.toMatch(
      /createCustomerAccessToken[^;]*from "@\/lib\/proposals\/customer-portal\/token"/
    );

    const clientPortal = readRepo(
      "components/proposals/customer-portal/customer-proposal-portal.tsx"
    );
    expect(clientPortal).toContain('"use client"');
    expect(clientPortal).toContain("buildCustomerProposalPdfPath");
    expect(clientPortal).toContain(
      'from "@/lib/proposals/customer-portal/token"'
    );
    expect(clientPortal).not.toContain("create-customer-access-token");
    expect(clientPortal).not.toContain("createCustomerAccessToken");
    expect(clientPortal).not.toContain("node:crypto");
    expect(clientPortal).not.toContain("randomBytes");
  });

  it("includes the respond link in the default email message", () => {
    const message = buildSendProposalMessage(
      "Alex",
      "Bright Bathrooms",
      "https://example.com/p/token123"
    );

    expect(message).toContain("View your proposal:");
    expect(message).toContain("https://example.com/p/token123");
    expect(message).toContain("PDF copy is also attached");
    expect(message).toContain("Bright Bathrooms");
  });
});
