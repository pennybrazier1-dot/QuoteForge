import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildInvoiceDraftAttentionItems,
  invoiceAttentionItemId,
  invoiceReviewHref,
  INVOICE_READY_ATTENTION_REASON,
} from "@/lib/invoices/attention";
import { buildHomeAttentionItems } from "@/lib/home/home-attention";
import type { HomeProposal } from "@/lib/home/home-data";
import { canRequestPayment } from "@/lib/payments/job-payment";

function readRepo(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function baseProposal(overrides: Partial<HomeProposal> = {}): HomeProposal {
  return {
    id: "prop-1",
    proposal_number: "QF-2026-0003",
    customer_name: "Jordan Portside",
    title: "Outdoor tap",
    job_summary: "Fit tap",
    rough_notes: null,
    scope_of_work: null,
    job_address: "8 Harbour View",
    status: "needs_attention",
    attention_reason: "customer_question",
    booking_confirmation: null,
    total_amount: 22000,
    created_at: "2026-11-02T10:00:00.000Z",
    updated_at: "2026-11-02T10:00:00.000Z",
    accepted_at: null,
    sent_at: null,
    booked_at: null,
    completed_at: null,
    planned_start_date_text: null,
    planned_start_date: null,
    planned_start_time: null,
    estimated_duration: null,
    ...overrides,
  };
}

describe("Stage 1 / 1B invoice system wiring", () => {
  it("creates one draft on complete and reuses on conflict", () => {
    const ensure = readRepo("lib/invoices/ensure-draft.ts");
    const lifecycle = readRepo("app/proposals/lifecycle-actions.ts");
    const migration = readRepo(
      "supabase/migrations/20261102200000_invoices.sql"
    );

    expect(lifecycle).toContain("ensureInvoiceDraftForJob");
    expect(ensure).toContain("unique");
    expect(ensure).toContain("isUniqueViolation");
    expect(ensure).toContain("created: false");
    expect(ensure).toContain("INVOICE_DRAFT_CREATED_NOTE");
    expect(migration).toContain("unique (proposal_id)");
    expect(migration).toContain("allocate_invoice_number");
  });

  it("links customer and job fields into the draft insert", () => {
    const ensure = readRepo("lib/invoices/ensure-draft.ts");
    expect(ensure).toContain("customer_id");
    expect(ensure).toContain("job_id");
    expect(ensure).toContain("customer_name");
    expect(ensure).toContain("agreed_total_amount");
    expect(ensure).toContain("source_vat_amount");
    expect(ensure).toContain("buildInvoiceDraftFromProposal");
  });

  it("records draft creation in job history once on insert", () => {
    const ensure = readRepo("lib/invoices/ensure-draft.ts");
    const createdBlock = ensure.slice(
      ensure.indexOf("await recordProposalEvent")
    );
    expect(createdBlock).toContain("INVOICE_DRAFT_CREATED_NOTE");
    expect(createdBlock).toContain("invoice_draft_created");
  });

  it("builds a single invoice attention item with review href", () => {
    const items = buildInvoiceDraftAttentionItems([
      {
        id: "inv-1",
        proposal_id: "prop-1",
        invoice_number: "INV-2026-0001",
        status: "draft",
        customer_name: "Jordan Portside",
        job_title: "Outdoor tap",
        total_amount: 22000,
        balance_due: 22000,
        currency: "GBP",
      },
      {
        id: "inv-1",
        proposal_id: "prop-1",
        invoice_number: "INV-2026-0001",
        status: "approved",
        customer_name: "Jordan Portside",
        job_title: "Outdoor tap",
        total_amount: 22000,
        balance_due: 0,
        currency: "GBP",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(invoiceAttentionItemId("inv-1"));
    expect(items[0]?.reason).toBe(INVOICE_READY_ATTENTION_REASON);
    expect(items[0]?.href).toBe(invoiceReviewHref("prop-1"));
    expect(items[0]?.customer).toBe("Jordan Portside");
  });

  it("merges invoice attention once without duplicating proposal items", () => {
    const items = buildHomeAttentionItems(
      [baseProposal()],
      new Date("2026-11-02T12:00:00.000Z"),
      [
        {
          id: "inv-1",
          proposal_id: "prop-completed",
          invoice_number: "INV-2026-0001",
          status: "draft",
          customer_name: "Jordan Portside",
          job_title: "Outdoor tap",
          total_amount: 22000,
          balance_due: 22000,
          currency: "GBP",
        },
      ]
    );

    const invoiceItems = items.filter(
      (item) => item.kind === "invoice_ready_for_review"
    );
    expect(invoiceItems).toHaveLength(1);
    expect(invoiceItems[0]?.href).toBe("/proposals/prop-completed/invoice");
    expect(items[0]?.kind).toBe("invoice_ready_for_review");
  });

  it("save and approve actions never send email or mark paid", () => {
    const actions = readRepo("lib/invoices/actions.ts");
    expect(actions).toContain("saveInvoiceDraftAction");
    expect(actions).toContain("approveInvoiceAction");
    expect(actions).not.toContain("sendNotificationEmail");
    expect(actions).not.toContain("sendProposalToCustomer");
    expect(actions).not.toContain("requestJobPaymentAction");
    const approveFn = actions.slice(
      actions.indexOf("export async function approveInvoiceAction"),
      actions.indexOf("export async function retryPrepareInvoiceDraftAction")
    );
    const saveFn = actions.slice(
      actions.indexOf("export async function saveInvoiceDraftAction"),
      actions.indexOf("export async function approveInvoiceAction")
    );
    // Save/approve must not request payment or mark paid.
    expect(approveFn).not.toContain('payment_status: "requested"');
    expect(approveFn).not.toContain('payment_status: "paid"');
    expect(saveFn).not.toContain("payment_status");
    expect(actions).toContain('email_sent: false');
    expect(actions).toContain("payment_requested: false");
    expect(actions).toContain("marked_paid: false");
    expect(actions).toContain('status: "approved"');
    expect(actions).toContain("validateInvoiceDraft");
  });

  it("approved invoices cannot be silently rewritten and reopen preserves drafts", () => {
    const migration = readRepo(
      "supabase/migrations/20261102200000_invoices.sql"
    );
    const actions = readRepo("lib/invoices/actions.ts");
    const lifecycle = readRepo("app/proposals/lifecycle-actions.ts");
    const ensure = readRepo("lib/invoices/ensure-draft.ts");

    expect(migration).toContain("prevent_approved_invoice_rewrite");
    expect(migration).toContain("Approved invoices cannot be rewritten");
    expect(migration).toContain("agreed_total_amount");
    expect(migration).toContain("tax_confirmed");
    expect(actions).toContain("Only draft invoices can be edited.");
    expect(lifecycle).toContain("assertInvoiceAllowsReopen");
    expect(lifecycle).not.toContain("deleteDraftInvoiceForProposal");
    expect(ensure).toContain("assertInvoiceAllowsReopen");
    expect(ensure).toContain("Draft (and void) rows are kept");
    expect(ensure).toContain("approved invoice");
  });

  it("keeps existing payment request workflow intact", () => {
    expect(
      canRequestPayment({
        jobStatus: "completed",
        paymentStatus: "not_requested",
        closedAt: null,
      })
    ).toBe(true);

    const workspace = readRepo(
      "components/proposals/proposal-workspace.tsx"
    );
    expect(workspace).toContain("CompletedJobPayment");
    expect(workspace).toContain("Review Invoice");
    expect(workspace).toContain("/proposals/${proposal.id}/invoice");
  });

  it("scopes invoice access to the trader workspace", () => {
    const ensure = readRepo("lib/invoices/ensure-draft.ts");
    const actions = readRepo("lib/invoices/actions.ts");
    const page = readRepo("app/(workspace)/proposals/[id]/invoice/page.tsx");
    const migration = readRepo(
      "supabase/migrations/20261102200000_invoices.sql"
    );

    expect(ensure).toContain('.eq("workspace_id", workspaceId)');
    expect(actions).toContain("requireTrader");
    expect(actions).toContain('.eq("workspace_id", auth.workspaceId)');
    expect(page).toContain(".eq(\"workspace_id\", profile.workspace_id)");
    expect(migration).toContain("workspace_id = public.current_workspace_id()");
  });

  it("review UI distinguishes draft from approved and blocks unsafe approve", () => {
    const ui = readRepo("components/invoices/invoice-review-screen.tsx");
    expect(ui).toContain("Save Draft");
    expect(ui).toContain("Preview Invoice");
    expect(ui).toContain("Approve Invoice");
    expect(ui).toContain("Stage 1 does not send an email");
    expect(ui).toContain("qf-invoice-status-draft");
    expect(ui).toContain("qf-invoice-status-approved");
    expect(ui).toContain("Confirm free / included");
    expect(ui).toContain("disabled={!canApprove}");
    expect(ui).toContain("validateInvoiceDraft");
    expect(ui).toContain('isApproved ? "Invoice approved"');
    expect(ui).toContain("Invoice ready for review");
  });

  it("keeps mobile invoice actions above the New (+) bottom-nav overhang", () => {
    const css = readRepo("app/globals.css");
    const sharedIdx = css.indexOf(".qf-mobile-bottom-actions");
    expect(sharedIdx).toBeGreaterThan(-1);
    const mobileBlock = css.slice(
      Math.max(0, sharedIdx - 120),
      sharedIdx + 900
    );
    expect(mobileBlock).toContain("@media (max-width: 1023px)");
    expect(mobileBlock).toContain("position: sticky");
    expect(mobileBlock).toContain("--qf-bottom-nav-measured-height");
    expect(mobileBlock).toContain("--qf-bottom-nav-total-height");
    expect(mobileBlock).toContain("z-index: 90");
    expect(css).toMatch(
      /\.qf-invoice-page\s*\{[^}]*padding-bottom:\s*0/
    );
    const ui = readRepo("components/invoices/invoice-review-screen.tsx");
    expect(ui).toContain("qf-invoice-actions qf-mobile-bottom-actions");
  });

  it("does not recycle invoice numbers after a lost concurrent insert", () => {
    const ensure = readRepo("lib/invoices/ensure-draft.ts");
    expect(ensure).toContain("do not recycle");
    expect(ensure).not.toContain("next_invoice_number - 1");
  });
});
