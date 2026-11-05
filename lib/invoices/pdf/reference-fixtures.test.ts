import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInvoicePdfData } from "@/lib/invoices/pdf/build-data";
import { generateInvoicePdf } from "@/lib/invoices/pdf/generate";
import type { InvoiceRecord } from "@/lib/invoices/types";

function invoice(overrides: Partial<InvoiceRecord>): InvoiceRecord {
  return {
    id: "inv-ref",
    workspace_id: "ws-ref",
    proposal_id: "prop-ref",
    customer_id: null,
    job_id: null,
    invoice_number: "INV-2026-0001",
    status: "approved",
    currency: "GBP",
    business_name: "Sam Sparks E2E Ltd",
    issued_address_line_1: "33 Oak Avenue",
    issued_address_line_2: null,
    issued_town: "Leeds",
    issued_county: null,
    issued_postcode: "LS1 1AA",
    issued_phone: "07700900123",
    issued_email: "sam.sparks@example.test",
    issued_vat_number: "GB123456789",
    issued_website: null,
    issued_company_number: "01234567",
    issued_logo_path: null,
    business_snapshot_at: "2026-11-03T00:00:00.000Z",
    customer_name: "Morgan Pricecheck",
    customer_email: "morgan.pricecheck@example.test",
    customer_phone: null,
    customer_address: "33 Oak Avenue, Leeds LS1 1AA",
    job_title: "Proposal for Morgan Pricecheck",
    job_address: "33 Oak Avenue, Leeds LS1 1AA",
    work_description: "Consumer unit needs replacing after site look-over",
    line_items: [
      {
        id: "li-1",
        kind: "labour",
        description: "On-site labour",
        quantity: 1,
        unit_amount: 200000,
        total_amount: 200000,
        pricing_state: "priced",
      },
    ],
    flags: [],
    notes: null,
    subtotal_amount: 200000,
    vat_amount: 40000,
    total_amount: 240000,
    amount_paid: 0,
    opening_amount_paid: 0,
    balance_due: 240000,
    agreed_total_amount: 240000,
    source_vat_amount: 40000,
    adjustment_confirmed: true,
    tax_confirmed: true,
    created_by: null,
    approved_by: null,
    created_at: "2026-11-03T00:00:00.000Z",
    updated_at: "2026-11-03T00:00:00.000Z",
    approved_at: "2026-11-03T00:00:00.000Z",
    ...overrides,
  };
}

const workspace = {
  business_name: "Sam Sparks E2E Ltd",
  contact_email: "sam.sparks@example.test",
  phone: "07700900123",
  address_line_1: "33 Oak Avenue",
  address_line_2: null,
  town: "Leeds",
  county: null,
  postcode: "LS1 1AA",
  vat_number: "GB123456789",
  company_number: "01234567",
};

describe("approved invoice reference fixtures", () => {
  it("renders the £2,400 VAT invoice and the £1,250 non-VAT invoice", async () => {
    const vat = buildInvoicePdfData({
      invoice: invoice({}),
      workspace,
      payment: null,
      logoBytes: null,
    });
    expect(vat.vatNumber).toBe("GB123456789");
    expect(vat.totalLabel).toBe("£2,400.00");
    expect(vat.vatLabel).toBe("£400.00");
    expect(vat.balanceDueLabel).toBe("£2,400.00");
    expect(vat.payment).toBeNull();

    const nonVatInvoice = invoice({
      invoice_number: "INV-2026-0002",
      issued_vat_number: null,
      issued_company_number: null,
      line_items: [
        {
          id: "li-2",
          kind: "labour",
          description: "On-site labour — two time return visits",
          quantity: 1,
          unit_amount: 125000,
          total_amount: 125000,
          pricing_state: "priced",
        },
      ],
      subtotal_amount: 125000,
      vat_amount: 0,
      total_amount: 125000,
      balance_due: 125000,
      agreed_total_amount: 125000,
      source_vat_amount: 0,
    });
    const nonVat = buildInvoicePdfData({
      invoice: nonVatInvoice,
      workspace: { ...workspace, vat_number: null, company_number: null },
      payment: {
        accountName: "Sam Sparks E2E Ltd",
        sortCode: "04-00-04",
        accountNumber: "12345678",
        reference: "QH-18-0001",
        notes: null,
      },
      logoBytes: null,
    });
    expect(nonVat.vatNumber).toBeNull();
    expect(nonVat.vatLabel).toBe("£0.00");
    expect(nonVat.totalLabel).toBe("£1,250.00");
    expect(nonVat.payment?.sortCode).toBe("04-00-04");

    const vatPdf = await generateInvoicePdf(vat);
    const nonVatPdf = await generateInvoicePdf({ ...nonVat, draftWatermark: false });
    const draftPdf = await generateInvoicePdf({
      ...vat,
      draftWatermark: true,
      invoiceNumber: "INV-DRAFT",
    });
    expect(vatPdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(nonVatPdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(draftPdf.includes(Buffer.from("DRAFT"))).toBe(true);

    const out = "/tmp/reanvil-p3j-visual";
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/vat-2400.pdf`, vatPdf);
    writeFileSync(`${out}/nonvat-1250.pdf`, nonVatPdf);
    writeFileSync(`${out}/draft.pdf`, draftPdf);
  });
});
