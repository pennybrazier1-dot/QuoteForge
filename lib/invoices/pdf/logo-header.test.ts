import { describe, expect, it } from "vitest";
import { buildInvoicePdfData } from "@/lib/invoices/pdf/build-data";
import { generateInvoicePdf } from "@/lib/invoices/pdf/generate";
import type { InvoiceRecord } from "@/lib/invoices/types";

const invoice = {
  id: "inv-test",
  workspace_id: "ws-test",
  proposal_id: "prop-test",
  customer_id: null,
  job_id: null,
  invoice_number: "INV-2026-0099",
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
  customer_name: "Alex Customer",
  customer_email: "alex@example.test",
  customer_phone: null,
  customer_address: "1 Test Street",
  job_title: "Consumer unit upgrade",
  job_address: "1 Test Street",
  work_description: "Replace consumer unit",
  line_items: [
    {
      id: "li-1",
      kind: "labour",
      description: "Labour",
      quantity: 1,
      unit_amount: 100000,
      total_amount: 100000,
      pricing_state: "priced",
    },
  ],
  flags: [],
  notes: null,
  subtotal_amount: 100000,
  vat_amount: 0,
  total_amount: 100000,
  amount_paid: 0,
  balance_due: 100000,
  agreed_total_amount: 100000,
  source_vat_amount: 0,
  adjustment_confirmed: true,
  tax_confirmed: true,
  created_by: null,
  approved_by: null,
  created_at: "2026-11-03T12:00:00.000Z",
  updated_at: "2026-11-03T12:00:00.000Z",
  approved_at: "2026-11-03T12:00:00.000Z",
  opening_amount_paid: 0,
} satisfies InvoiceRecord;

const workspace = {
  business_name: "Sam Sparks E2E Ltd",
  contact_email: "sam@example.test",
  phone: "07700900123",
  address_line_1: "12 Forge Yard",
  address_line_2: null,
  town: "Leeds",
  county: null,
  postcode: "LS1 1AA",
  vat_number: "GB123456789",
  website: "https://samsparks.example",
  company_number: "12345678",
};

describe("invoice PDF logo header", () => {
  it("omits YOUR LOGO HERE when no logo bytes are provided", async () => {
    const data = buildInvoicePdfData({
      invoice,
      workspace,
      payment: null,
    });
    expect(data.logoBytes).toBeNull();
    const buffer = await generateInvoicePdf(data);
    const text = buffer.toString("latin1");
    expect(text).not.toContain("YOUR LOGO");
    expect(text).toContain("Sam Sparks E2E Ltd");
    // Same font family as approved quote PDF (QF-2026-0003).
    expect(text).toContain("DancingScript");
    expect(text).toContain("PlayfairDisplay");
    expect(text).toContain("Inter");
  });

  it("embeds a logo when bytes are provided", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const data = buildInvoicePdfData({
      invoice,
      workspace,
      payment: null,
      logoBytes: png,
    });
    expect(data.logoBytes?.length).toBeGreaterThan(0);
    const buffer = await generateInvoicePdf(data);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.toString("latin1")).not.toContain("YOUR LOGO");
  });
});
