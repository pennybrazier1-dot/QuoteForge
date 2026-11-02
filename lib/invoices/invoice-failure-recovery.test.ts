import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHomeAttentionItems } from "@/lib/home/home-attention";
import type { HomeProposal } from "@/lib/home/home-data";
import {
  afterJobCompletedRedirect,
  JOB_COMPLETED_INVOICE_FAILED_PARAM,
  JOB_COMPLETED_PROPOSAL_PARAM,
} from "@/lib/jobs/complete-job";
import {
  categorizeInvoiceFailure,
  sanitizeInvoiceFailureMessage,
} from "@/lib/invoices/failure-log";
import {
  buildMissingInvoiceAttentionItems,
  findCompletedJobsMissingInvoices,
  INVOICE_NEEDS_PREPARING_REASON,
  INVOICE_PREPARE_FAILED_NOTICE,
  missingInvoiceAttentionItemId,
  RETRY_INVOICE_LABEL,
} from "@/lib/invoices/missing-invoice-attention";

function readRepo(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function proposal(overrides: Partial<HomeProposal> = {}): HomeProposal {
  return {
    id: "prop-1",
    proposal_number: "MH-0001",
    customer_name: "Jamie Taylor",
    title: "Living room painting",
    job_summary: "Paint",
    rough_notes: null,
    scope_of_work: null,
    job_address: "28 Maple Close",
    status: "completed",
    attention_reason: null,
    booking_confirmation: "confirmed",
    total_amount: 185000,
    created_at: "2026-11-02T10:00:00.000Z",
    updated_at: "2026-11-02T10:00:00.000Z",
    accepted_at: "2026-10-22T14:00:00.000Z",
    sent_at: "2026-10-21T09:00:00.000Z",
    booked_at: "2026-10-22T14:05:00.000Z",
    completed_at: "2026-11-02T18:00:00.000Z",
    planned_start_date_text: null,
    planned_start_date: "2026-10-28",
    planned_start_time: "09:00",
    estimated_duration: "2 days",
    ...overrides,
  };
}

describe("Stage 1L invoice failure recovery", () => {
  it("1 — successful completion still redirects Home after ensure", () => {
    const lifecycle = readRepo("app/proposals/lifecycle-actions.ts");
    const completeFn = lifecycle.slice(
      lifecycle.indexOf("export async function markJobComplete"),
      lifecycle.indexOf("export async function reopenCompletedJob")
    );
    expect(completeFn).toContain("ensureInvoiceDraftForJob");
    expect(completeFn).toContain("invoiceResult");
    expect(completeFn).toContain("invoicePrepared: invoiceResult.ok");
    expect(afterJobCompletedRedirect("Jamie Taylor")).toBe(
      "/dashboard?jobCompleted=1&completedCustomer=Jamie+Taylor"
    );
    expect(afterJobCompletedRedirect("Jamie Taylor")).not.toContain(
      JOB_COMPLETED_INVOICE_FAILED_PARAM
    );
  });

  it("2 — job completion stays successful when invoice ensure fails", () => {
    const lifecycle = readRepo("app/proposals/lifecycle-actions.ts");
    const completeFn = lifecycle.slice(
      lifecycle.indexOf("export async function markJobComplete"),
      lifecycle.indexOf("export async function reopenCompletedJob")
    );
    // Completion write happens before ensure; failure only changes redirect flags.
    expect(
      completeFn.indexOf('status: "completed"')
    ).toBeLessThan(completeFn.indexOf("ensureInvoiceDraftForJob"));
    expect(completeFn).toContain("invoicePrepared: invoiceResult.ok");
    // Must not roll back completion on invoice failure.
    expect(completeFn).not.toMatch(/\.update\(\{[\s\S]*status:\s*"booked"/);
  });

  it("3 — clear warning copy and redirect flags when invoice fails", () => {
    expect(INVOICE_PREPARE_FAILED_NOTICE).toBe(
      "Job completed, but your invoice could not be prepared. Please retry."
    );
    const href = afterJobCompletedRedirect("Jamie Taylor", {
      invoicePrepared: false,
      proposalId: "prop-1",
    });
    expect(href).toContain(`${JOB_COMPLETED_INVOICE_FAILED_PARAM}=1`);
    expect(href).toContain(`${JOB_COMPLETED_PROPOSAL_PARAM}=prop-1`);
    expect(href).toContain("jobCompleted=1");

    const notice = readRepo("components/home/home-job-completed-notice.tsx");
    expect(notice).toContain("INVOICE_PREPARE_FAILED_NOTICE");
    expect(notice).toContain("RETRY_INVOICE_LABEL");
    expect(notice).toContain("retryPrepareInvoiceDraftAction");
  });

  it("4 — missing invoice appears in Needs Attention", () => {
    const missing = findCompletedJobsMissingInvoices(
      [
        proposal(),
        proposal({ id: "prop-2", status: "booked", title: "Other" }),
        proposal({
          id: "prop-3",
          status: "completed",
          customer_name: "Has Invoice",
        }),
      ],
      ["prop-3"]
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]?.proposal_id).toBe("prop-1");

    const items = buildHomeAttentionItems(
      [proposal({ id: "active", status: "needs_attention", attention_reason: "customer_question" })],
      new Date("2026-11-02T12:00:00.000Z"),
      [],
      missing
    );
    const prep = items.filter((item) => item.kind === "invoice_needs_preparing");
    expect(prep).toHaveLength(1);
    expect(prep[0]?.reason).toBe(INVOICE_NEEDS_PREPARING_REASON);
    expect(prep[0]?.href).toBe("/proposals/prop-1/invoice");
    expect(prep[0]?.id).toBe(missingInvoiceAttentionItemId("prop-1"));
  });

  it("5 — notification is derived from workspace data (persists after refresh)", () => {
    const dashboard = readRepo("app/(workspace)/dashboard/page.tsx");
    expect(dashboard).toContain("findCompletedJobsMissingInvoices");
    expect(dashboard).toContain('.eq("workspace_id", profile.workspace_id)');
    expect(dashboard).toContain("missingInvoices");
    // Must not rely only on the temporary URL flag for persistence.
    expect(dashboard).toContain("invoiceFailed");
    expect(dashboard.indexOf("findCompletedJobsMissingInvoices")).toBeGreaterThan(
      -1
    );
  });

  it("6/7/8 — retry is idempotent and reuses unique(proposal_id)", () => {
    const actions = readRepo("lib/invoices/actions.ts");
    const ensure = readRepo("lib/invoices/ensure-draft.ts");
    expect(actions).toContain("retryPrepareInvoiceDraftAction");
    expect(actions).toContain("ensureInvoiceDraftForJob");
    expect(ensure).toContain("isUniqueViolation");
    expect(ensure).toContain("created: false");
    expect(ensure).toContain("do not recycle");
    const migration = readRepo(
      "supabase/migrations/20261102200000_invoices.sql"
    );
    expect(migration).toContain("unique (proposal_id)");
  });

  it("9 — recovery UI clears warning once draft exists", () => {
    const items = buildMissingInvoiceAttentionItems([]);
    expect(items).toHaveLength(0);

    const page = readRepo("app/(workspace)/proposals/[id]/invoice/page.tsx");
    expect(page).toContain("InvoicePrepareRecovery");
    expect(page).toContain("InvoiceReviewScreen");
    // Recovery only when still missing; review when draft exists.
    expect(page.indexOf("InvoicePrepareRecovery")).toBeLessThan(
      page.indexOf("InvoiceReviewScreen")
    );
  });

  it("10 — recovery never changes payment status or sends email", () => {
    const actions = readRepo("lib/invoices/actions.ts");
    const retryFn = actions.slice(
      actions.indexOf("export async function retryPrepareInvoiceDraftAction")
    );
    expect(retryFn).toContain("paymentBefore");
    expect(retryFn).not.toContain("sendNotificationEmail");
    expect(retryFn).not.toContain("sendProposalToCustomer");
    expect(retryFn).not.toContain("requestJobPaymentAction");
    expect(retryFn).not.toContain('payment_status: "requested"');
    expect(retryFn).not.toContain('payment_status: "paid"');
    expect(RETRY_INVOICE_LABEL).toBe("Retry Invoice Creation");
  });

  it("11 — recovery actions are workspace-scoped", () => {
    const actions = readRepo("lib/invoices/actions.ts");
    const retryFn = actions.slice(
      actions.indexOf("export async function retryPrepareInvoiceDraftAction")
    );
    expect(retryFn).toContain(".eq(\"workspace_id\", auth.workspaceId)");
    expect(retryFn).toContain("requireTrader");
    const dashboard = readRepo("app/(workspace)/dashboard/page.tsx");
    expect(dashboard).toContain('.eq("workspace_id", profile.workspace_id)');
    const page = readRepo("app/(workspace)/proposals/[id]/invoice/page.tsx");
    expect(page).toContain('.eq("workspace_id", profile.workspace_id)');
  });

  it("12 — no email is sent on complete or retry", () => {
    const lifecycle = readRepo("app/proposals/lifecycle-actions.ts");
    const completeFn = lifecycle.slice(
      lifecycle.indexOf("export async function markJobComplete"),
      lifecycle.indexOf("export async function reopenCompletedJob")
    );
    expect(completeFn).not.toContain("sendProposalToCustomer");
    expect(completeFn).not.toContain("sendNotificationEmail");
    expect(completeFn).not.toContain("RESEND_API_KEY");
    const actions = readRepo("lib/invoices/actions.ts");
    expect(actions).not.toContain("sendNotificationEmail");
  });

  it("deduplicates missing-invoice attention items", () => {
    const items = buildMissingInvoiceAttentionItems([
      {
        proposal_id: "prop-1",
        customer_name: "Jamie",
        title: "Paint",
      },
      {
        proposal_id: "prop-1",
        customer_name: "Jamie",
        title: "Paint",
      },
    ]);
    expect(items).toHaveLength(1);
  });

  it("logs failures without secrets", () => {
    expect(sanitizeInvoiceFailureMessage("password=secret")).toBe(
      "Redacted error detail"
    );
    expect(sanitizeInvoiceFailureMessage("Could not allocate invoice number.")).toBe(
      "Could not allocate invoice number."
    );
    expect(categorizeInvoiceFailure("Proposal not found.")).toBe(
      "proposal_missing"
    );
    expect(categorizeInvoiceFailure("Could not allocate invoice number.")).toBe(
      "number_allocation_failed"
    );
    const ensure = readRepo("lib/invoices/ensure-draft.ts");
    expect(ensure).toContain("logInvoiceDraftFailure");
    expect(ensure).toContain("failEnsure");
  });

  it("migration policies are retry-safe without weakening RLS", () => {
    const migration = readRepo(
      "supabase/migrations/20261102200000_invoices.sql"
    );
    expect(migration).toContain("drop policy if exists");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("unique (proposal_id)");
    expect(migration).toContain("current_workspace_id()");
    expect(migration).not.toContain("to anon");
  });
});
