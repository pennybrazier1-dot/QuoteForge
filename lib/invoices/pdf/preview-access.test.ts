import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Batch A invoice PDF isolation", () => {
  it("adds logo drawing without changing the quote PDF placeholder", () => {
    const layout = readRepo("lib/proposals/pdf/layout.ts");
    const quote = readRepo("lib/proposals/pdf/render.ts");
    expect(layout).toContain("export function drawLogoPlaceholder");
    expect(layout).toContain("YOUR LOGO");
    expect(layout).toContain("export function drawLogoImage");
    expect(quote).toContain("drawLogoPlaceholder");
    expect(quote).not.toContain("drawLogoImage");
  });

  it("freezes branding at approval and does not send email", () => {
    const actions = readRepo("lib/invoices/actions.ts");
    const approve = actions.slice(
      actions.indexOf("export async function approveInvoiceAction"),
      actions.indexOf("export async function retryPrepareInvoiceDraftAction")
    );
    const snapshot = readRepo("lib/invoices/business-snapshot.ts");
    expect(approve).toContain("buildInvoiceBusinessSnapshotColumns");
    expect(approve).toContain("captureInvoiceLogoSnapshot");
    expect(snapshot).toContain("issued_logo_path");
    expect(approve).toContain("email_sent: false");
    expect(approve).not.toContain("notifyCustomerOfInvoiceIssued");
    expect(approve).not.toContain("sendInvoiceEmailAction");
    expect(actions).not.toContain("sendInvoiceEmailAction");
    expect(actions).not.toContain("recordInvoicePayment");
    expect(actions).not.toContain("closeJobAction");
  });

  it("keeps trader preview workspace-scoped and customer download approved-only", () => {
    const trader = readRepo(
      "app/(workspace)/proposals/[id]/invoice/pdf/route.ts"
    );
    const customer = readRepo("app/p/[token]/invoice/pdf/route.ts");
    const loader = readRepo("lib/invoices/pdf/load-invoice-pdf.ts");
    const screen = readRepo("components/invoices/invoice-review-screen.tsx");
    expect(trader).toContain("workspace_id");
    expect(trader).toContain("allowDraft: true");
    expect(trader).toContain("Sign in required.");
    expect(customer).toContain("generatePublicInvoicePdfBuffer");
    expect(loader).toContain('.eq("status", "approved")');
    expect(loader).toContain("trimmed.length < 16");
    expect(loader).not.toContain("amount_waived");
    expect(loader).not.toContain("amount_credited");
    expect(loader).not.toContain("credit-notes");
    expect(screen).toContain("Preview PDF");
    expect(screen).toContain("Opening the PDF does not send an email.");
    expect(screen).not.toContain("sendInvoiceEmailAction");
  });
});
