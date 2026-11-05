import { describe, expect, it } from "vitest";
import {
  customerFacingInvoiceLineItems,
  isDraftSuggestionInvoiceLine,
  isDraftSuggestionMaterialDescription,
} from "@/lib/invoices/customer-facing-lines";
import { buildInvoicePdfData } from "@/lib/invoices/pdf/build-data";
import type { InvoiceRecord } from "@/lib/invoices/types";

describe("customer-facing invoice lines", () => {
  it("detects draft-suggestion placeholders", () => {
    expect(
      isDraftSuggestionInvoiceLine({
        description:
          "Draft suggestion: Consumer unit upgrade materials — prices to be confirmed",
        unit_amount: 0,
        total_amount: 0,
      })
    ).toBe(true);
    expect(
      isDraftSuggestionMaterialDescription(
        "Draft suggestion: Fixings and consumables — prices to be confirmed"
      )
    ).toBe(true);
  });

  it("keeps legitimate zero-value lines", () => {
    expect(
      isDraftSuggestionInvoiceLine({
        description: "Travel included",
        unit_amount: 0,
        total_amount: 0,
      })
    ).toBe(false);
  });

  it("filters draft suggestions from PDF data without changing totals", () => {
    const invoice = {
      id: "inv-1",
      workspace_id: "w1",
      proposal_id: "p1",
      customer_id: null,
      job_id: null,
      invoice_number: "INV-2026-0002",
      status: "approved",
      currency: "GBP",
      business_name: "Sam Sparks E2E Ltd",
      issued_address_line_1: null,
      issued_address_line_2: null,
      issued_town: null,
      issued_county: null,
      issued_postcode: null,
      issued_phone: null,
      issued_email: null,
      issued_vat_number: null,
      issued_website: null,
      issued_company_number: null,
      issued_logo_path: null,
      business_snapshot_at: null,
      customer_name: "Morgan Pricecheck",
      customer_email: "morgan@example.test",
      customer_phone: "07700900789",
      customer_address: "22 Oak Avenue",
      job_title: "Proposal for Morgan",
      job_address: "22 Oak Avenue",
      work_description: "Consumer unit",
      line_items: [
        {
          id: "labour-1",
          kind: "labour",
          description: "On-site labour",
          quantity: 1,
          unit_amount: 152000,
          total_amount: 152000,
          pricing_state: "priced",
        },
        {
          id: "materials-1",
          kind: "materials",
          description:
            "Draft suggestion: Consumer unit upgrade materials — prices to be confirmed",
          quantity: 1,
          unit_amount: 0,
          total_amount: 0,
          pricing_state: "zero_confirmed",
        },
        {
          id: "materials-2",
          kind: "materials",
          description: "Travel included",
          quantity: 1,
          unit_amount: 0,
          total_amount: 0,
          pricing_state: "zero_confirmed",
        },
      ],
      flags: [],
      notes: null,
      subtotal_amount: 152000,
      vat_amount: 0,
      total_amount: 152000,
      amount_paid: 152000,
      balance_due: 0,
      agreed_total_amount: 152000,
      source_vat_amount: 0,
      adjustment_confirmed: true,
      tax_confirmed: true,
      created_by: null,
      approved_by: null,
      created_at: "2026-11-03T00:00:00.000Z",
      updated_at: "2026-11-03T00:00:00.000Z",
      approved_at: "2026-11-03T00:00:00.000Z",
      opening_amount_paid: 0,
    } satisfies InvoiceRecord;

    const pdf = buildInvoicePdfData({
      invoice,
      workspace: {
        business_name: "Sam Sparks E2E Ltd",
        contact_email: "sam@example.test",
        phone: "07700900123",
        address_line_1: null,
        address_line_2: null,
        town: null,
        county: null,
        postcode: null,
        vat_number: null,
      },
      payment: null,
    });

    expect(pdf.lineItems).toHaveLength(2);
    expect(pdf.lineItems.map((line) => line.description)).toEqual([
      "On-site labour",
      "Travel included",
    ]);
    expect(pdf.totalLabel).toBe("£1,520.00");
    expect(pdf.subtotalLabel).toBe("£1,520.00");
    expect(customerFacingInvoiceLineItems(invoice.line_items)).toHaveLength(2);
    // Source snapshot unchanged.
    expect(invoice.line_items).toHaveLength(3);
  });
});
