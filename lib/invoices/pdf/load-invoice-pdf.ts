import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveInvoicePdfLogoBytes,
  resolveInvoicePdfWorkspaceSource,
  WORKSPACE_BRANDING_SELECT,
} from "@/lib/invoices/business-snapshot";
import {
  buildInvoicePdfData,
  resolveInvoicePaymentInstructions,
  type InvoicePdfProposalBankSource,
  type InvoicePdfSettingsBankSource,
  type InvoicePdfWorkspaceSource,
} from "@/lib/invoices/pdf/build-data";
import {
  generateInvoicePdf,
  invoicePdfFileName,
} from "@/lib/invoices/pdf/generate";
import { INVOICE_SELECT } from "@/lib/invoices/current-invoice";
import { loadInvoiceForProposal } from "@/lib/invoices/ensure-draft";
import { parseInvoiceRow } from "@/lib/invoices/parse";
import type { InvoiceRecord } from "@/lib/invoices/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const WORKSPACE_INVOICE_PDF_SELECT = WORKSPACE_BRANDING_SELECT;

const PROPOSAL_BANK_SELECT =
  "id, workspace_id, customer_access_token, issued_bank_account_name, issued_bank_sort_code, issued_bank_account_number, issued_bank_reference";

const SETTINGS_BANK_SELECT =
  "accept_bank_transfer, bank_account_name, bank_sort_code, bank_account_number, bank_reference_instructions";

export type InvoicePdfBufferResult =
  | { ok: true; buffer: Buffer; fileName: string; invoice: InvoiceRecord }
  | { ok: false; error: string; status?: number };

async function loadPaymentContext(
  supabase: SupabaseClient,
  proposalId: string,
  workspaceId: string
): Promise<{
  proposal: InvoicePdfProposalBankSource | null;
  settings: InvoicePdfSettingsBankSource | null;
}> {
  const [{ data: proposal }, { data: settings }] = await Promise.all([
    supabase
      .from("proposals")
      .select(PROPOSAL_BANK_SELECT)
      .eq("id", proposalId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("workspace_payment_settings")
      .select(SETTINGS_BANK_SELECT)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  return {
    proposal: (proposal as InvoicePdfProposalBankSource | null) ?? null,
    settings: (settings as InvoicePdfSettingsBankSource | null) ?? null,
  };
}

async function loadWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<InvoicePdfWorkspaceSource | null> {
  const { data } = await supabase
    .from("workspaces")
    .select(WORKSPACE_INVOICE_PDF_SELECT)
    .eq("id", workspaceId)
    .maybeSingle();
  return (data as InvoicePdfWorkspaceSource | null) ?? null;
}

export async function generateInvoicePdfBufferForInvoice(
  supabase: SupabaseClient,
  invoice: InvoiceRecord,
  options?: { allowDraft?: boolean }
): Promise<InvoicePdfBufferResult> {
  if (invoice.status === "void") {
    return {
      ok: false,
      error: "This invoice has been cancelled.",
      status: 404,
    };
  }
  if (invoice.status === "draft" && !options?.allowDraft) {
    return {
      ok: false,
      error: "Invoice is not approved yet.",
      status: 404,
    };
  }
  if (invoice.status !== "approved" && invoice.status !== "draft") {
    return { ok: false, error: "Invoice not available.", status: 404 };
  }

  const liveWorkspace = await loadWorkspace(supabase, invoice.workspace_id);
  if (!liveWorkspace) {
    return { ok: false, error: "Business details not found.", status: 404 };
  }

  // Approved + snapshot → frozen branding. Draft / legacy → live workspace.
  const { workspace } = resolveInvoicePdfWorkspaceSource({
    invoice,
    liveWorkspace,
  });

  const [{ proposal, settings }, logoBytes] = await Promise.all([
    loadPaymentContext(supabase, invoice.proposal_id, invoice.workspace_id),
    resolveInvoicePdfLogoBytes(supabase, invoice),
  ]);
  const payment = resolveInvoicePaymentInstructions({ proposal, settings });
  const pdfData = buildInvoicePdfData({
    invoice,
    workspace,
    payment,
    draftWatermark: invoice.status === "draft",
    logoBytes,
  });

  const buffer = await generateInvoicePdf(pdfData);
  if (!buffer.length) {
    return { ok: false, error: "Generated PDF was empty.", status: 500 };
  }

  return {
    ok: true,
    buffer,
    fileName: invoicePdfFileName(invoice.invoice_number),
    invoice,
  };
}

/** Trader-authenticated PDF for a proposal's invoice. */
export async function generateTraderInvoicePdfBuffer(
  supabase: SupabaseClient,
  proposalId: string,
  workspaceId: string,
  options?: { allowDraft?: boolean }
): Promise<InvoicePdfBufferResult> {
  const invoice = await loadInvoiceForProposal(
    supabase,
    proposalId,
    workspaceId
  );
  if (!invoice) {
    return { ok: false, error: "Invoice not found.", status: 404 };
  }
  return generateInvoicePdfBufferForInvoice(supabase, invoice, options);
}

/**
 * Customer portal PDF — token must match the proposal that owns the invoice.
 * Only approved invoices are downloadable for customers.
 */
export async function generatePublicInvoicePdfBuffer(
  token: string
): Promise<InvoicePdfBufferResult> {
  const trimmed = token.trim();
  if (trimmed.length < 16) {
    return { ok: false, error: "This link is not valid.", status: 404 };
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      error: "The customer portal is not configured yet.",
      status: 503,
    };
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id, workspace_id, customer_access_token")
    .eq("customer_access_token", trimmed)
    .maybeSingle();

  if (proposalError || !proposal) {
    return { ok: false, error: "This link is not valid.", status: 404 };
  }

  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("proposal_id", proposal.id)
    .eq("workspace_id", proposal.workspace_id)
    .eq("status", "approved")
    .maybeSingle();

  if (invoiceError || !invoiceRow) {
    return { ok: false, error: "Invoice not available.", status: 404 };
  }

  const invoice = parseInvoiceRow(invoiceRow as Record<string, unknown>);
  return generateInvoicePdfBufferForInvoice(supabase, invoice);
}
