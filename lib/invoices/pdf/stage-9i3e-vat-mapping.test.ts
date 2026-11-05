import { describe, expect, it } from "vitest";
import { buildInvoicePdfData } from "@/lib/invoices/pdf/build-data";
import { resolveInvoicePdfWorkspaceSource } from "@/lib/invoices/business-snapshot";
import type { InvoiceRecord } from "@/lib/invoices/types";

function base(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "inv", workspace_id: "ws", proposal_id: "p", customer_id: null, job_id: null,
    invoice_number: "INV-X", status: "approved", currency: "GBP",
    business_name: "Beta Changed Traders Ltd",
    issued_address_line_1: "1", issued_address_line_2: null, issued_town: "Leeds",
    issued_county: null, issued_postcode: "LS1 1AA", issued_phone: null, issued_email: null,
    issued_vat_number: "GB222222222", issued_website: null, issued_company_number: null,
    issued_logo_path: null, business_snapshot_at: "2026-11-04T12:00:00.000Z",
    customer_name: "C", customer_email: null, customer_phone: null, customer_address: null,
    job_title: "J", job_address: null, work_description: null, line_items: [],
    flags: [], notes: null, subtotal_amount: 200000, vat_amount: 40000, total_amount: 240000,
    amount_paid: 0, balance_due: 240000, agreed_total_amount: 240000, source_vat_amount: 40000,
    adjustment_confirmed: true, tax_confirmed: true, created_by: null, approved_by: null,
    created_at: "2026-11-04T12:00:00.000Z", updated_at: "2026-11-04T12:00:00.000Z",
    approved_at: "2026-11-04T12:00:00.000Z",
    opening_amount_paid: 0,
    ...overrides,
  };
}

describe("9I.3e PDF VAT mapping", () => {
  it("shows frozen VAT number and 2000+400=2400 even if live settings changed", () => {
    const invoice = base();
    const { workspace, source } = resolveInvoicePdfWorkspaceSource({
      invoice,
      liveWorkspace: {
        business_name: "Changed", contact_email: null, phone: null,
        address_line_1: null, address_line_2: null, town: null, county: null, postcode: null,
        vat_number: "GB999999973", website: null, company_number: null,
      },
    });
    expect(source).toBe("snapshot");
    const data = buildInvoicePdfData({ invoice, workspace, payment: null });
    expect(data.vatNumber).toBe("GB222222222");
    expect(data.subtotalLabel).toContain("2,000.00");
    expect(data.vatLabel).toContain("400.00");
    expect(data.totalLabel).toContain("2,400.00");
  });

  it("maps outstanding from the invoice balance_due row without recalculating the total", () => {
    const invoice = base({
      amount_paid: 60000,
      balance_due: 0,
    });
    const { workspace } = resolveInvoicePdfWorkspaceSource({
      invoice,
      liveWorkspace: {
        business_name: "Beta Changed Traders Ltd",
        contact_email: null,
        phone: null,
        address_line_1: null,
        address_line_2: null,
        town: null,
        county: null,
        postcode: null,
        vat_number: "GB222222222",
        website: null,
        company_number: null,
      },
    });
    const data = buildInvoicePdfData({ invoice, workspace, payment: null });
    expect(data.totalLabel).toContain("2,400.00");
    expect(data.amountPaidLabel).toContain("600.00");
    expect(data.balanceDueLabel).toBe("£0.00");
  });

  it("does not invent a VAT number for non-VAT traders", () => {
    const invoice = base({
      issued_vat_number: null,
      vat_amount: 0,
      total_amount: 200000,
      balance_due: 200000,
      source_vat_amount: 0,
      business_name: "Other Trader Stage9C Ltd",
    });
    const { workspace } = resolveInvoicePdfWorkspaceSource({
      invoice,
      liveWorkspace: {
        business_name: "Other Trader Stage9C Ltd", contact_email: null, phone: null,
        address_line_1: null, address_line_2: null, town: null, county: null, postcode: null,
        vat_number: null, website: null, company_number: null,
      },
    });
    const data = buildInvoicePdfData({ invoice, workspace, payment: null });
    expect(data.vatNumber).toBeNull();
    expect(data.vatLabel).toContain("0.00");
    expect(data.totalLabel).toContain("2,000.00");
  });
});
