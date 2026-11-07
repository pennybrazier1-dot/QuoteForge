import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoiceIssuedEmail } from "@/lib/invoices/email-issued";
import { INVOICE_SELECT } from "@/lib/invoices/current-invoice";
import { generateInvoicePdfBufferForInvoice } from "@/lib/invoices/pdf/load-invoice-pdf";
import { parseInvoiceRow } from "@/lib/invoices/parse";
import type { InvoiceRecord } from "@/lib/invoices/types";
import { ensureProposalCustomerAccessToken } from "@/lib/proposals/customer-portal/ensure-token";
import {
  enqueueAndDeliverOutboundMessage,
  type DeliverOutboundResult,
} from "@/lib/outbound/deliver";
import { findOutboundByIdempotencyKey } from "@/lib/outbound/handoff";
import { invoiceIssuedKey } from "@/lib/outbound/keys";
import type { SendNotificationEmailInput } from "@/lib/email/send-notification-email";

export type NotifyInvoiceIssuedResult =
  | {
      ok: true;
      skipped?: undefined;
      outboundId: string;
      delivery: DeliverOutboundResult;
    }
  | {
      ok: true;
      skipped: "no_recipient" | "already_terminal" | "not_notifiable";
      reason: string;
    }
  | { ok: false; error: string };

type InvoiceIssuedEmailPayload = SendNotificationEmailInput & {
  attachments: NonNullable<SendNotificationEmailInput["attachments"]>;
};

async function loadApprovedInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  workspaceId: string
): Promise<InvoiceRecord | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .maybeSingle();
  if (error || !data) return null;
  return parseInvoiceRow(data as Record<string, unknown>);
}

/**
 * Build the customer email and PDF for one approved invoice.
 * The PDF renderer reads the invoice row, including the frozen business snapshot.
 * The portal token is placed only in the customer email links. It is not logged.
 */
export async function buildInvoiceIssuedEmailPayload(
  supabase: SupabaseClient,
  invoice: InvoiceRecord,
  workspaceId: string
): Promise<
  { ok: true; payload: InvoiceIssuedEmailPayload } | { ok: false; error: string }
> {
  const recipient = invoice.customer_email?.trim() ?? "";
  if (!recipient || !recipient.includes("@")) {
    return { ok: false, error: "Customer has no email address." };
  }

  const tokenResult = await ensureProposalCustomerAccessToken(
    supabase,
    invoice.proposal_id
  );
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: tokenResult.error || "Could not prepare customer portal link.",
    };
  }

  const pdf = await generateInvoicePdfBufferForInvoice(supabase, invoice);
  if (!pdf.ok) {
    return { ok: false, error: pdf.error || "Could not generate invoice PDF." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("business_name, contact_email")
    .eq("id", workspaceId)
    .maybeSingle();

  const businessName =
    invoice.business_name?.trim() ||
    workspace?.business_name?.trim() ||
    "Reanvil";
  const jobTitle = invoice.job_title?.trim() || "your job";
  const email = buildInvoiceIssuedEmail({
    businessName,
    customerName: invoice.customer_name,
    jobTitle,
    invoiceNumber: invoice.invoice_number,
    totalAmount: invoice.total_amount,
    amountPaid: invoice.amount_paid,
    balanceDue: invoice.balance_due,
    portalToken: tokenResult.token,
    logoUrl: null,
  });

  return {
    ok: true,
    payload: {
      to: recipient,
      subject: email.subject,
      message: email.text,
      html: email.html,
      businessName: email.businessName,
      heading: email.heading,
      preheader: email.preheader,
      ctaUrl: email.ctaUrl,
      ctaLabel: email.ctaLabel,
      replyTo: workspace?.contact_email,
      audience: "customer",
      attachments: [
        {
          filename: pdf.fileName,
          content: pdf.buffer,
        },
      ],
    },
  };
}

/**
 * Explicit invoice email. Uses the committed invoice_issued idempotency key.
 * Does not update invoice amounts, the branding snapshot, payments, or the job.
 */
export async function notifyCustomerOfInvoiceIssued(
  supabase: SupabaseClient,
  invoiceId: string,
  workspaceId: string
): Promise<NotifyInvoiceIssuedResult> {
  try {
    const invoice = await loadApprovedInvoice(supabase, invoiceId, workspaceId);
    if (!invoice) {
      return {
        ok: true,
        skipped: "not_notifiable",
        reason: "Only approved invoices can be emailed.",
      };
    }

    const recipient = invoice.customer_email?.trim() ?? "";
    if (!recipient || !recipient.includes("@")) {
      return {
        ok: true,
        skipped: "no_recipient",
        reason: "Customer has no email address for invoice delivery.",
      };
    }

    const idempotencyKey = invoiceIssuedKey(invoice.id);
    const existing = await findOutboundByIdempotencyKey(
      supabase,
      workspaceId,
      idempotencyKey
    );
    if (
      existing &&
      (existing.status === "provider_accepted" || existing.status === "simulated")
    ) {
      return {
        ok: true,
        skipped: "already_terminal",
        reason: "Invoice email already accepted by the provider.",
      };
    }

    const built = await buildInvoiceIssuedEmailPayload(
      supabase,
      invoice,
      workspaceId
    );
    if (!built.ok) {
      return { ok: false, error: built.error };
    }

    const delivery = await enqueueAndDeliverOutboundMessage(supabase, {
      workspaceId,
      eventKind: "invoice_issued",
      audience: "customer",
      sourceType: "invoice",
      sourceId: invoice.id,
      recipientEmail: recipient,
      idempotencyKey,
      subject: built.payload.subject,
      proposalId: invoice.proposal_id,
      invoiceId: invoice.id,
      metadata: {
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        balance_due: invoice.balance_due,
      },
    }, built.payload);

    if (!delivery.messageId && !delivery.ok) {
      return {
        ok: false,
        error: delivery.error || "Invoice email could not be sent.",
      };
    }

    return {
      ok: true,
      outboundId: delivery.messageId || existing?.id || "",
      delivery,
    };
  } catch (error) {
    console.warn(
      "[invoice-notify]",
      error instanceof Error ? error.message : "notify failed"
    );
    return { ok: false, error: "Could not send invoice email." };
  }
}
