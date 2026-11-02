import {
  isInvoiceFlag,
  isInvoiceLineKind,
  isInvoiceLinePricingState,
  isInvoiceStatus,
  type InvoiceFlag,
  type InvoiceLineItem,
  type InvoiceLinePricingState,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/lib/invoices/types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) {
      return value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferPricingState(input: {
  kind: InvoiceLineItem["kind"];
  totalAmount: number;
  raw: unknown;
}): InvoiceLinePricingState {
  if (
    typeof input.raw === "string" &&
    isInvoiceLinePricingState(input.raw)
  ) {
    if (input.totalAmount > 0) {
      return "priced";
    }
    return input.raw;
  }
  if (input.totalAmount > 0) {
    return "priced";
  }
  if (input.kind === "labour") {
    return "priced";
  }
  // Legacy Stage 1 rows without pricing_state: treat £0 non-labour as unpriced.
  return "included_unpriced";
}

export function parseInvoiceLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") {
        return null;
      }
      const row = raw as Record<string, unknown>;
      const kind =
        typeof row.kind === "string" && isInvoiceLineKind(row.kind)
          ? row.kind
          : "other";
      const description =
        typeof row.description === "string" ? row.description.trim() : "";
      if (!description) {
        return null;
      }
      const quantity =
        typeof row.quantity === "number" && Number.isFinite(row.quantity)
          ? Math.max(0, row.quantity)
          : 1;
      const unitAmount =
        typeof row.unit_amount === "number" && Number.isFinite(row.unit_amount)
          ? Math.max(0, Math.round(row.unit_amount))
          : 0;
      const totalAmount =
        typeof row.total_amount === "number" && Number.isFinite(row.total_amount)
          ? Math.max(0, Math.round(row.total_amount))
          : Math.round(quantity * unitAmount);
      return {
        id:
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim()
            : `line-${index + 1}`,
        kind,
        description,
        quantity,
        unit_amount: unitAmount,
        total_amount: totalAmount,
        pricing_state: inferPricingState({
          kind,
          totalAmount,
          raw: row.pricing_state,
        }),
      } satisfies InvoiceLineItem;
    })
    .filter((item): item is InvoiceLineItem => Boolean(item));
}

export function parseInvoiceFlags(value: unknown): InvoiceFlag[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is InvoiceFlag =>
      typeof item === "string" && isInvoiceFlag(item)
  );
}

export function parseInvoiceRow(row: Record<string, unknown>): InvoiceRecord {
  const status =
    typeof row.status === "string" && isInvoiceStatus(row.status)
      ? (row.status as InvoiceStatus)
      : "draft";
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    proposal_id: String(row.proposal_id),
    customer_id:
      typeof row.customer_id === "string" ? row.customer_id : null,
    job_id: typeof row.job_id === "string" ? row.job_id : null,
    invoice_number: String(row.invoice_number ?? ""),
    status,
    currency: String(row.currency ?? "GBP"),
    business_name:
      typeof row.business_name === "string" ? row.business_name : null,
    customer_name:
      typeof row.customer_name === "string" ? row.customer_name : null,
    customer_email:
      typeof row.customer_email === "string" ? row.customer_email : null,
    customer_phone:
      typeof row.customer_phone === "string" ? row.customer_phone : null,
    customer_address:
      typeof row.customer_address === "string" ? row.customer_address : null,
    job_title: String(row.job_title ?? "Job"),
    job_address: typeof row.job_address === "string" ? row.job_address : null,
    work_description:
      typeof row.work_description === "string" ? row.work_description : null,
    line_items: parseInvoiceLineItems(row.line_items),
    flags: parseInvoiceFlags(row.flags),
    notes: typeof row.notes === "string" ? row.notes : null,
    subtotal_amount: Number(row.subtotal_amount ?? 0),
    vat_amount: Number(row.vat_amount ?? 0),
    total_amount: Number(row.total_amount ?? 0),
    amount_paid: Number(row.amount_paid ?? 0),
    balance_due: Number(row.balance_due ?? 0),
    agreed_total_amount: Number(
      row.agreed_total_amount ?? row.total_amount ?? 0
    ),
    source_vat_amount: Number(row.source_vat_amount ?? row.vat_amount ?? 0),
    adjustment_confirmed: Boolean(row.adjustment_confirmed),
    tax_confirmed: Boolean(row.tax_confirmed),
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    approved_by: typeof row.approved_by === "string" ? row.approved_by : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    approved_at: typeof row.approved_at === "string" ? row.approved_at : null,
  };
}

export function parseStringListField(value: unknown): string[] {
  return asStringArray(value);
}
