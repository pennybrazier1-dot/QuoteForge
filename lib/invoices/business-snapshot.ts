/**
 * Stage 9I.3a — approved invoice business branding snapshot.
 *
 * Capture happens at approve time (not PDF download).
 * - business_snapshot_at set  → use issued_* + issued_logo_path only.
 * - business_snapshot_at null → legacy pre-9I.3a; fall back to live workspace
 *   branding (documented). Never rewrite historical approved rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoicePdfWorkspaceSource } from "@/lib/invoices/pdf/build-data";
import type { InvoiceRecord } from "@/lib/invoices/types";
import {
  copyWorkspaceLogoToInvoiceSnapshot,
  downloadStorageObjectBytes,
  downloadWorkspaceLogoBytes,
} from "@/lib/workspace/branding-logo";

export const WORKSPACE_BRANDING_SELECT =
  "business_name, contact_email, phone, address_line_1, address_line_2, town, county, postcode, vat_number, website, company_number";

export type WorkspaceBrandingSource = {
  business_name: string;
  contact_email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  vat_number: string | null;
  website: string | null;
  company_number: string | null;
};

export type InvoiceBusinessSnapshotColumns = {
  business_name: string | null;
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
  business_snapshot_at: string;
};

/** True when this invoice has a 9I.3a branding snapshot. */
export function invoiceHasBusinessSnapshot(
  invoice: Pick<InvoiceRecord, "business_snapshot_at">
): boolean {
  return Boolean(invoice.business_snapshot_at?.trim());
}

export function buildInvoiceBusinessSnapshotColumns(input: {
  workspace: WorkspaceBrandingSource;
  logoPath: string | null;
  capturedAtIso: string;
}): InvoiceBusinessSnapshotColumns {
  const { workspace, logoPath, capturedAtIso } = input;
  return {
    business_name: workspace.business_name?.trim() || null,
    issued_address_line_1: workspace.address_line_1?.trim() || null,
    issued_address_line_2: workspace.address_line_2?.trim() || null,
    issued_town: workspace.town?.trim() || null,
    issued_county: workspace.county?.trim() || null,
    issued_postcode: workspace.postcode?.trim() || null,
    issued_phone: workspace.phone?.trim() || null,
    issued_email: workspace.contact_email?.trim() || null,
    issued_vat_number: workspace.vat_number?.trim() || null,
    issued_website: workspace.website?.trim() || null,
    issued_company_number: workspace.company_number?.trim() || null,
    issued_logo_path: logoPath,
    business_snapshot_at: capturedAtIso,
  };
}

/**
 * Resolve branding for PDF generation.
 * Approved + snapshot → frozen fields.
 * Draft or legacy approved → live workspace (caller supplies live).
 */
export function resolveInvoicePdfWorkspaceSource(input: {
  invoice: InvoiceRecord;
  liveWorkspace: InvoicePdfWorkspaceSource;
}): {
  workspace: InvoicePdfWorkspaceSource;
  source: "snapshot" | "legacy_live" | "draft_live";
} {
  const { invoice, liveWorkspace } = input;

  if (invoice.status === "draft") {
    return { workspace: liveWorkspace, source: "draft_live" };
  }

  if (!invoiceHasBusinessSnapshot(invoice)) {
    // Legacy approved invoices (pre-9I.3a): explicit live fallback.
    return { workspace: liveWorkspace, source: "legacy_live" };
  }

  return {
    source: "snapshot",
    workspace: {
      business_name:
        invoice.business_name?.trim() || liveWorkspace.business_name,
      contact_email: invoice.issued_email,
      phone: invoice.issued_phone,
      address_line_1: invoice.issued_address_line_1,
      address_line_2: invoice.issued_address_line_2,
      town: invoice.issued_town,
      county: invoice.issued_county,
      postcode: invoice.issued_postcode,
      vat_number: invoice.issued_vat_number,
      website: invoice.issued_website,
      company_number: invoice.issued_company_number,
    },
  };
}

/**
 * Logo bytes for PDF: snapshot path when frozen; live only for draft/legacy.
 * Approved snapshot with null logo path must NOT fall back to the current logo.
 */
export async function resolveInvoicePdfLogoBytes(
  supabase: SupabaseClient,
  invoice: InvoiceRecord
): Promise<Buffer | null> {
  if (invoice.status === "approved" && invoiceHasBusinessSnapshot(invoice)) {
    const path = invoice.issued_logo_path?.trim();
    if (!path) {
      return null;
    }
    if (!path.startsWith(`${invoice.workspace_id}/`)) {
      // Refuse cross-workspace paths even if a row were somehow wrong.
      return null;
    }
    return downloadStorageObjectBytes(supabase, path);
  }

  return downloadWorkspaceLogoBytes(supabase, invoice.workspace_id);
}

export async function loadWorkspaceBranding(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<WorkspaceBrandingSource | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select(WORKSPACE_BRANDING_SELECT)
    .eq("id", workspaceId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as WorkspaceBrandingSource;
}

/**
 * Copy current workspace logo into an invoice-scoped immutable path.
 * Returns null when the workspace has no logo.
 */
export async function captureInvoiceLogoSnapshot(
  supabase: SupabaseClient,
  workspaceId: string,
  invoiceId: string
): Promise<{ ok: true; path: string | null } | { ok: false; error: string }> {
  return copyWorkspaceLogoToInvoiceSnapshot(supabase, workspaceId, invoiceId);
}
