import { customerFacingInvoiceLineItems } from "@/lib/invoices/customer-facing-lines";
import type { InvoiceRecord } from "@/lib/invoices/types";
import type {
  InvoicePdfData,
  InvoicePdfPaymentInstructions,
} from "@/lib/invoices/pdf/types";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";

export type InvoicePdfWorkspaceSource = {
  business_name: string;
  contact_email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  vat_number: string | null;
  website?: string | null;
  company_number?: string | null;
};

export type InvoicePdfProposalBankSource = {
  issued_bank_account_name?: string | null;
  issued_bank_sort_code?: string | null;
  issued_bank_account_number?: string | null;
  issued_bank_reference?: string | null;
};

export type InvoicePdfSettingsBankSource = {
  accept_bank_transfer?: boolean | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
  bank_reference_instructions?: string | null;
};

function formatInvoiceDate(iso: string | null): string {
  if (!iso) {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
      new Date()
    );
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function workspaceAddressLines(
  workspace: InvoicePdfWorkspaceSource
): string[] {
  return [
    workspace.address_line_1,
    workspace.address_line_2,
    [workspace.town, workspace.county].filter(Boolean).join(", ") || null,
    workspace.postcode,
  ]
    .map((line) => line?.trim() || "")
    .filter(Boolean);
}

/**
 * Prefer issued bank details snapshotted on the proposal when present.
 * Fall back to authorised workspace payment settings — never invent numbers.
 */
export function resolveInvoicePaymentInstructions(input: {
  proposal: InvoicePdfProposalBankSource | null;
  settings: InvoicePdfSettingsBankSource | null;
}): InvoicePdfPaymentInstructions | null {
  const issuedName = input.proposal?.issued_bank_account_name?.trim() || "";
  const issuedSort = input.proposal?.issued_bank_sort_code?.trim() || "";
  const issuedAccount =
    input.proposal?.issued_bank_account_number?.trim() || "";
  if (issuedName && issuedSort && issuedAccount) {
    return {
      accountName: issuedName,
      sortCode: issuedSort,
      accountNumber: issuedAccount,
      reference: input.proposal?.issued_bank_reference?.trim() || null,
      notes: null,
    };
  }

  if (!input.settings?.accept_bank_transfer) {
    return null;
  }
  const name = input.settings.bank_account_name?.trim() || "";
  const sort = input.settings.bank_sort_code?.trim() || "";
  const account = input.settings.bank_account_number?.trim() || "";
  if (!name || !sort || !account) {
    return null;
  }
  return {
    accountName: name,
    sortCode: sort,
    accountNumber: account,
    reference: null,
    notes: input.settings.bank_reference_instructions?.trim() || null,
  };
}

/**
 * Build PDF data from the approved (or draft-preview) invoice row.
 * Original priced amounts always come from the invoice record.
 * Payment/balance labels use amount_paid and balance_due (collectible =
 * total − paid − waived). Settlement never rewrites priced totals/VAT.
 *
 * Branding (`workspace` + `logoBytes`) is resolved by the loader:
 * - approved with business_snapshot_at → frozen issued_* / logo path
 * - draft or legacy approved (null snapshot) → live workspace fallback
 * Layout positions are unchanged — only the data source switches.
 */
export function buildInvoicePdfData(input: {
  invoice: InvoiceRecord;
  workspace: InvoicePdfWorkspaceSource;
  payment: InvoicePdfPaymentInstructions | null;
  draftWatermark?: boolean;
  /** Resolved logo bytes (snapshot or live). Never invent a placeholder. */
  logoBytes?: Buffer | null;
}): InvoicePdfData {
  const { invoice, workspace, payment } = input;
  const businessName = resolveCustomerFacingBusinessName(
    invoice.business_name || workspace.business_name
  );
  const vatNumber = workspace.vat_number?.trim() || null;

  return {
    invoiceNumber: invoice.invoice_number,
    invoiceDateLabel: formatInvoiceDate(invoice.approved_at || invoice.created_at),
    businessName,
    logoBytes: input.logoBytes ?? null,
    businessPhone: workspace.phone?.trim() || null,
    businessEmail: workspace.contact_email?.trim() || null,
    businessAddressLines: workspaceAddressLines(workspace),
    // Never invent a VAT number — only show what the resolved branding source has.
    vatNumber,
    website: workspace.website?.trim() || null,
    companyNumber: workspace.company_number?.trim() || null,
    customerName: invoice.customer_name?.trim() || "Customer",
    customerEmail: invoice.customer_email?.trim() || null,
    customerPhone: invoice.customer_phone?.trim() || null,
    customerAddress: invoice.customer_address?.trim() || null,
    jobTitle: invoice.job_title,
    jobAddress: invoice.job_address?.trim() || null,
    workDescription: invoice.work_description?.trim() || null,
    // Presentation filter only — approved invoice rows are not rewritten.
    // Draft-suggestion placeholders are omitted from the customer PDF while
    // priced totals remain the immutable invoice amounts.
    lineItems: customerFacingInvoiceLineItems(invoice.line_items),
    subtotalLabel: formatPenceAsGbp(invoice.subtotal_amount),
    vatLabel: formatPenceAsGbp(invoice.vat_amount),
    totalLabel: formatPenceAsGbp(invoice.total_amount),
    amountPaidLabel: formatPenceAsGbp(invoice.amount_paid),
    // Outstanding = authoritative collectible (0 after full pay or waiver).
    balanceDueLabel: formatPenceAsGbp(invoice.balance_due),
    notes: invoice.notes?.trim() || null,
    payment,
    draftWatermark: input.draftWatermark === true,
  };
}
