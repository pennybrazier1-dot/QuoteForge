import { describe, expect, it } from "vitest";
import {
  buildInvoiceBusinessSnapshotColumns,
  invoiceHasBusinessSnapshot,
  resolveInvoicePdfWorkspaceSource,
} from "@/lib/invoices/business-snapshot";
import type { InvoiceRecord } from "@/lib/invoices/types";

const liveWorkspace = {
  business_name: "Live Business B Ltd",
  contact_email: "b@example.test",
  phone: "07000000002",
  address_line_1: "Address B",
  address_line_2: null,
  town: "Bradford",
  county: null,
  postcode: "BD1 1AA",
  vat_number: "GB999999999",
  website: "https://live-b.example",
  company_number: "99999999",
};

function baseInvoice(
  overrides: Partial<InvoiceRecord> = {}
): InvoiceRecord {
  return {
    id: "inv-1",
    workspace_id: "ws-1",
    proposal_id: "prop-1",
    customer_id: null,
    job_id: null,
    invoice_number: "INV-TEST-1",
    status: "approved",
    currency: "GBP",
    business_name: "Frozen Business A Ltd",
    issued_address_line_1: "Address A",
    issued_address_line_2: null,
    issued_town: "Leeds",
    issued_county: null,
    issued_postcode: "LS1 1AA",
    issued_phone: "07000000001",
    issued_email: "a@example.test",
    issued_vat_number: "GB111111111",
    issued_website: "https://frozen-a.example",
    issued_company_number: "11111111",
    issued_logo_path: "ws-1/invoice-branding/inv-1/logo.png",
    business_snapshot_at: "2026-11-04T10:00:00.000Z",
    customer_name: "Customer",
    customer_email: null,
    customer_phone: null,
    customer_address: null,
    job_title: "Job",
    job_address: null,
    work_description: null,
    line_items: [],
    flags: [],
    notes: null,
    subtotal_amount: 10000,
    vat_amount: 0,
    total_amount: 10000,
    amount_paid: 0,
    balance_due: 10000,
    agreed_total_amount: 10000,
    source_vat_amount: 0,
    adjustment_confirmed: true,
    tax_confirmed: true,
    created_by: null,
    approved_by: null,
    created_at: "2026-11-04T09:00:00.000Z",
    updated_at: "2026-11-04T10:00:00.000Z",
    approved_at: "2026-11-04T10:00:00.000Z",
    opening_amount_paid: 0,
    ...overrides,
  };
}

describe("invoice business snapshot (9I.3a)", () => {
  it("builds approve-time columns from workspace branding", () => {
    const columns = buildInvoiceBusinessSnapshotColumns({
      workspace: {
        business_name: " Frozen Business A Ltd ",
        contact_email: " a@example.test ",
        phone: "07000000001",
        address_line_1: "Address A",
        address_line_2: null,
        town: "Leeds",
        county: null,
        postcode: "LS1 1AA",
        vat_number: "GB111111111",
        website: "https://frozen-a.example",
        company_number: "11111111",
      },
      logoPath: "ws-1/invoice-branding/inv-1/logo.png",
      capturedAtIso: "2026-11-04T10:00:00.000Z",
    });
    expect(columns.business_name).toBe("Frozen Business A Ltd");
    expect(columns.issued_email).toBe("a@example.test");
    expect(columns.issued_vat_number).toBe("GB111111111");
    expect(columns.issued_logo_path).toContain("invoice-branding");
    expect(columns.business_snapshot_at).toBe("2026-11-04T10:00:00.000Z");
  });

  it("does not invent a VAT number when the workspace has none", () => {
    const columns = buildInvoiceBusinessSnapshotColumns({
      workspace: {
        ...liveWorkspace,
        vat_number: null,
      },
      logoPath: null,
      capturedAtIso: "2026-11-04T10:00:00.000Z",
    });
    expect(columns.issued_vat_number).toBeNull();
  });

  it("uses frozen branding for approved snapshots even when live workspace changed", () => {
    const invoice = baseInvoice();
    expect(invoiceHasBusinessSnapshot(invoice)).toBe(true);
    const { workspace, source } = resolveInvoicePdfWorkspaceSource({
      invoice,
      liveWorkspace,
    });
    expect(source).toBe("snapshot");
    expect(workspace.business_name).toBe("Frozen Business A Ltd");
    expect(workspace.address_line_1).toBe("Address A");
    expect(workspace.postcode).toBe("LS1 1AA");
    expect(workspace.phone).toBe("07000000001");
    expect(workspace.contact_email).toBe("a@example.test");
    expect(workspace.vat_number).toBe("GB111111111");
    expect(workspace.website).toBe("https://frozen-a.example");
    expect(workspace.company_number).toBe("11111111");
    expect(workspace.town).not.toBe(liveWorkspace.town);
  });

  it("falls back to live branding for legacy approved invoices without snapshot", () => {
    const invoice = baseInvoice({
      business_snapshot_at: null,
      issued_address_line_1: null,
      issued_logo_path: null,
    });
    expect(invoiceHasBusinessSnapshot(invoice)).toBe(false);
    const { workspace, source } = resolveInvoicePdfWorkspaceSource({
      invoice,
      liveWorkspace,
    });
    expect(source).toBe("legacy_live");
    expect(workspace).toEqual(liveWorkspace);
  });

  it("uses live branding for draft invoices", () => {
    const invoice = baseInvoice({
      status: "draft",
      business_snapshot_at: null,
      approved_at: null,
    });
    const { source } = resolveInvoicePdfWorkspaceSource({
      invoice,
      liveWorkspace,
    });
    expect(source).toBe("draft_live");
  });
});
