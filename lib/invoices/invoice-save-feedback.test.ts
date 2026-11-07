import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readRepo(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function invoiceReviewKey(page: string): string {
  const match = page.match(/<InvoiceReviewScreen\s+key=\{`([^`]+)`\}/);
  if (!match) {
    throw new Error("Invoice review key was not found.");
  }
  return match[1];
}

describe("invoice draft save feedback", () => {
  const page = readRepo("app/(workspace)/proposals/[id]/invoice/page.tsx");
  const screen = readRepo("components/invoices/invoice-review-screen.tsx");
  const actions = readRepo("lib/invoices/actions.ts");
  const saveFn = actions.slice(
    actions.indexOf("export async function saveInvoiceDraftAction"),
    actions.indexOf("export async function approveInvoiceAction")
  );

  it("shows Draft saved only after a successful save", () => {
    expect(screen).toContain("Draft saved.");
    expect(screen).toContain('saveState.success\n      ? "Draft saved."');
    expect(screen).toContain('role="status"');
    expect(screen).toContain("const initialState: InvoiceActionState = {}");
    expect(saveFn).toContain("success: true");
    expect(saveFn).toContain("revalidateInvoicePaths(proposalId)");
  });

  it("does not treat a failed save as a success", () => {
    expect(saveFn).not.toMatch(/return \{ error:[^}]*success:\s*true/);
    expect(saveFn).toContain('return { error: "Only draft invoices can be edited." }');
    expect(saveFn).toContain("return { error: fields.error }");
    expect(actions).toContain('return { error: "Add at least one line item." }');
    expect(screen).toContain("saveState.error || approveState.error");
    expect(screen).not.toContain('error ? "Draft saved."');
  });

  it("keeps the same screen across repeated draft saves", () => {
    const key = invoiceReviewKey(page);
    expect(key).toBe(
      '${invoice.id}-${invoice.status}-${emailStatus?.status ?? "none"}'
    );
    expect(key).not.toContain("updated_at");
    expect(page.match(/updated_at/g) ?? []).toHaveLength(0);
    expect(screen).toContain("useActionState(\n    saveInvoiceDraftAction");
  });

  it("does not show a fresh success message after reload", () => {
    expect(screen).toContain("useActionState(\n    saveInvoiceDraftAction,\n    initialState");
    expect(page).toContain("loadInvoiceForProposal");
    expect(actions).toContain(
      "revalidatePath(`/proposals/${proposalId}/invoice`)"
    );
  });
});

describe("invoice mobile action clearance", () => {
  const css = readRepo("app/globals.css");
  const screen = readRepo("components/invoices/invoice-review-screen.tsx");

  it("adds phone-only space so Save Draft does not cover the notes", () => {
    expect(screen).toContain(
      '<div className="qf-invoice-mobile-clearance" aria-hidden="true" />'
    );
    expect(css).toContain(".qf-invoice-mobile-clearance {\n  display: none;");
    const mobile = css.slice(css.indexOf(".qf-invoice-mobile-clearance {"));
    expect(mobile).toContain("@media (max-width: 1023px)");
    expect(mobile).toContain(
      "height: calc(20rem + env(safe-area-inset-bottom, 0px));"
    );
    expect(mobile).toContain("pointer-events: none");
    expect(mobile).toContain(".qf-invoice-notes textarea");
    expect(mobile).toContain(
      "scroll-margin-bottom: calc(20rem + env(safe-area-inset-bottom, 0px));"
    );
  });

  it("leaves the desktop action bar in normal flow", () => {
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.qf-mobile-bottom-actions \{\s*position: static;/
    );
    expect(css).toMatch(/\.qf-invoice-page\s*\{[^}]*padding-bottom:\s*0/);
    const clearance = css.slice(
      css.indexOf(".qf-invoice-mobile-clearance {"),
      css.indexOf(".qf-invoice-flag")
    );
    expect(clearance).not.toContain("min-width: 1024px");
  });
});
