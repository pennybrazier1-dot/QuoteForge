import type { InvoiceLineItem } from "@/lib/invoices/types";

export type InvoicePdfPaymentInstructions = {
  accountName: string | null;
  sortCode: string | null;
  accountNumber: string | null;
  reference: string | null;
  notes: string | null;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDateLabel: string;
  businessName: string;
  /** Embedded logo bytes. Null = name-only header (no placeholder). */
  logoBytes: Buffer | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessAddressLines: string[];
  vatNumber: string | null;
  /** Live workspace website at render time. Omit when blank. */
  website: string | null;
  /** Live workspace company number at render time. Omit when blank. */
  companyNumber: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  jobTitle: string;
  jobAddress: string | null;
  workDescription: string | null;
  lineItems: InvoiceLineItem[];
  subtotalLabel: string;
  vatLabel: string;
  totalLabel: string;
  amountPaidLabel: string;
  balanceDueLabel: string;
  notes: string | null;
  payment: InvoicePdfPaymentInstructions | null;
  /** Draft preview only — never used for emailed approved PDFs. */
  draftWatermark?: boolean;
};
