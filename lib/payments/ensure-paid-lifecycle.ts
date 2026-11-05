/**
 * Stage 9I.3c Part 3 — settle remaining balance via record_invoice_payment RPC.
 *
 * Does not write invoice amount_paid/balance_due directly.
 * Does not invent ledger rows when already fully settled (opening_amount_paid / zero balance).
 * Does not close the job.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProposalInvoicePresence } from "@/lib/invoices/current-invoice";
import { syncJobStatusForProposal } from "@/lib/jobs/sync-job-status";
import {
  markRemainingPaymentKey,
  parseRecordInvoicePaymentRpcResult,
} from "@/lib/payments/invoice-payment-ledger";
import { resolveRecordedPaymentMethod } from "@/lib/payments/record-invoice-payment";
import type { PaymentMethod } from "@/lib/payments/types";

export type EnsurePaidLifecycleResult = {
  invoiceSettled: boolean;
  invoiceAlreadySettled: boolean;
  jobSynced: boolean;
  paymentRecorded: boolean;
  /** invoice_payments.id when a ledger row was written or replayed. */
  paymentId?: string;
  amountRecordedPence?: number;
  outstandingPence?: number;
  warning?: string;
  error?: string;
};

async function markProposalPaidWithoutInvoice(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  proposalId: string;
  paymentMethod: PaymentMethod;
}): Promise<{ ok: boolean }> {
  const now = new Date().toISOString();
  const { data, error } = await input.supabase
    .from("proposals")
    .update({
      payment_status: "paid",
      paid_at: now,
      payment_method: input.paymentMethod,
      payment_provider: null,
      payment_provider_reference: null,
    })
    .eq("id", input.proposalId)
    .eq("workspace_id", input.workspaceId)
    .in("payment_status", ["requested", "partially_paid", "paid"])
    .is("closed_at", null)
    .select("id, payment_status")
    .maybeSingle();

  if (error) {
    return { ok: false };
  }
  return { ok: data?.payment_status === "paid" };
}

async function healAlreadySettled(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  proposalId: string;
  paymentMethod: PaymentMethod;
}): Promise<EnsurePaidLifecycleResult> {
  const jobSync = await syncJobStatusForProposal(
    input.supabase,
    input.proposalId,
    "paid"
  );
  await markProposalPaidWithoutInvoice(input);
  return {
    invoiceSettled: true,
    invoiceAlreadySettled: true,
    jobSynced: jobSync.ok,
    paymentRecorded: false,
    warning: jobSync.ok
      ? undefined
      : "Payment is recorded, but the job status could not be updated to paid. Try refreshing.",
  };
}

/**
 * Settle remaining approved-invoice balance through the ledger RPC (or no-op
 * when already settled). Sync job → paid when fully settled. Never closes.
 */
export async function ensurePaidInvoiceAndJob(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  proposalId: string;
  paymentMethodsIssued?: string[] | null;
}): Promise<EnsurePaidLifecycleResult> {
  const { supabase, workspaceId, proposalId } = input;
  const paymentMethod = resolveRecordedPaymentMethod(
    input.paymentMethodsIssued
  );

  // Current approved only. Never settle against void history or an unapproved draft.
  const presence = await loadProposalInvoicePresence(
    supabase,
    proposalId,
    workspaceId
  );
  const invoice =
    presence.current?.status === "approved" ? presence.current : null;

  if (!invoice) {
    // Mid-replace / draft-only: refuse the legacy no-invoice paid path.
    if (presence.current || presence.hasCancelledHistory) {
      return {
        invoiceSettled: false,
        invoiceAlreadySettled: false,
        jobSynced: false,
        paymentRecorded: false,
        error:
          presence.hasCancelledHistory && presence.current?.status !== "approved"
            ? "Previous invoice is void. Approve a current invoice before recording payment."
            : "Approve the invoice before marking payment as paid.",
      };
    }

    // Genuine legacy jobs with no invoice row at all.
    const proposalOk = await markProposalPaidWithoutInvoice({
      supabase,
      workspaceId,
      proposalId,
      paymentMethod,
    });
    const jobSync = await syncJobStatusForProposal(supabase, proposalId, "paid");
    if (!proposalOk.ok) {
      return {
        invoiceSettled: false,
        invoiceAlreadySettled: false,
        jobSynced: jobSync.ok,
        paymentRecorded: false,
        error: "Couldn't mark this payment as paid. Please try again.",
      };
    }
    return {
      invoiceSettled: false,
      invoiceAlreadySettled: false,
      jobSynced: jobSync.ok,
      paymentRecorded: false,
      warning: jobSync.ok
        ? undefined
        : "Payment is recorded, but the job status could not be updated to paid. Try refreshing.",
    };
  }

  const balanceDue = Math.max(0, Math.round(Number(invoice.balance_due ?? 0)));

  // Already fully settled (including historical opening_amount_paid) — no ledger invent.
  if (balanceDue <= 0) {
    return healAlreadySettled({
      supabase,
      workspaceId,
      proposalId,
      paymentMethod,
    });
  }

  const paidOn = new Date().toISOString().slice(0, 10);
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "record_invoice_payment",
    {
      p_invoice_id: invoice.id,
      p_amount_pence: balanceDue,
      p_method: paymentMethod,
      p_paid_on: paidOn,
      p_reference: null,
      p_note: "Marked as paid (remaining balance)",
      p_idempotency_key: markRemainingPaymentKey(String(invoice.id)),
    }
  );

  if (rpcError) {
    const message = rpcError.message ?? "";
    if (/already fully paid/i.test(message)) {
      return healAlreadySettled({
        supabase,
        workspaceId,
        proposalId,
        paymentMethod,
      });
    }
    return {
      invoiceSettled: false,
      invoiceAlreadySettled: false,
      jobSynced: false,
      paymentRecorded: false,
      error: "Couldn't record this payment on the invoice. Please try again.",
    };
  }

  const parsed = parseRecordInvoicePaymentRpcResult(rpcData);
  if (!parsed) {
    const { data: refreshed } = await supabase
      .from("invoices")
      .select("balance_due")
      .eq("id", invoice.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (Number(refreshed?.balance_due ?? 1) === 0) {
      return healAlreadySettled({
        supabase,
        workspaceId,
        proposalId,
        paymentMethod,
      });
    }
    return {
      invoiceSettled: false,
      invoiceAlreadySettled: false,
      jobSynced: false,
      paymentRecorded: false,
      error: "Couldn't record this payment on the invoice. Please try again.",
    };
  }

  if (!parsed.fully_settled) {
    return {
      invoiceSettled: false,
      invoiceAlreadySettled: false,
      jobSynced: parsed.job_status === "paid",
      paymentRecorded: !parsed.already_recorded,
      paymentId: parsed.payment_id,
      amountRecordedPence: parsed.amount_recorded,
      outstandingPence: parsed.balance_due,
      error: "Payment was recorded but the invoice is not fully settled.",
    };
  }

  return {
    invoiceSettled: true,
    invoiceAlreadySettled: Boolean(parsed.already_recorded),
    jobSynced: true,
    paymentRecorded: !parsed.already_recorded,
    paymentId: parsed.payment_id,
    amountRecordedPence: parsed.amount_recorded,
    outstandingPence: parsed.balance_due ?? 0,
  };
}
