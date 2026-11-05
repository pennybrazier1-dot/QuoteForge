export const INVOICE_STATUSES = ["draft", "approved", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_LINE_KINDS = [
  "labour",
  "materials",
  "extra",
  "other",
] as const;
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number];

export const INVOICE_LINE_PRICING_STATES = [
  "priced",
  "included_unpriced",
  "zero_confirmed",
] as const;
export type InvoiceLinePricingState =
  (typeof INVOICE_LINE_PRICING_STATES)[number];

export const INVOICE_FLAGS = [
  "missing_line_prices",
  "missing_total",
  "unconfirmed_zero_lines",
  "total_differs_from_agreed",
  "tax_unconfirmed",
] as const;
export type InvoiceFlag = (typeof INVOICE_FLAGS)[number];

export type InvoiceLineItem = {
  id: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  /** How a £0 or priced line should be treated for approval safety. */
  pricing_state: InvoiceLinePricingState;
};

export type InvoiceRecord = {
  id: string;
  workspace_id: string;
  proposal_id: string;
  customer_id: string | null;
  job_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  business_name: string | null;
  /** Frozen at approve (9I.3a / Thin B2). Null with null business_snapshot_at = legacy. */
  issued_address_line_1: string | null;
  issued_address_line_2: string | null;
  issued_town: string | null;
  issued_county: string | null;
  issued_postcode: string | null;
  issued_phone: string | null;
  issued_email: string | null;
  issued_vat_number: string | null;
  issued_website: string | null;
  issued_company_number: string | null;
  issued_logo_path: string | null;
  business_snapshot_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  job_title: string;
  job_address: string | null;
  work_description: string | null;
  line_items: InvoiceLineItem[];
  flags: InvoiceFlag[];
  notes: string | null;
  subtotal_amount: number;
  vat_amount: number;
  total_amount: number;
  amount_paid: number;
  /** Pre-ledger paid snapshot (MATH Thin B3). */
  opening_amount_paid: number;
  balance_due: number;
  agreed_total_amount: number;
  source_vat_amount: number;
  adjustment_confirmed: boolean;
  tax_confirmed: boolean;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

export type InvoiceDraftAttentionSource = {
  id: string;
  proposal_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  customer_name: string | null;
  job_title: string;
  total_amount: number;
  balance_due: number;
  currency: string;
};

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

export function isInvoiceLineKind(value: string): value is InvoiceLineKind {
  return (INVOICE_LINE_KINDS as readonly string[]).includes(value);
}

export function isInvoiceLinePricingState(
  value: string
): value is InvoiceLinePricingState {
  return (INVOICE_LINE_PRICING_STATES as readonly string[]).includes(value);
}

export function isInvoiceFlag(value: string): value is InvoiceFlag {
  return (INVOICE_FLAGS as readonly string[]).includes(value);
}
