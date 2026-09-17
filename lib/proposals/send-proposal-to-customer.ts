import type { SupabaseClient } from "@supabase/supabase-js";
import { sendProposalEmail } from "@/lib/email/send-proposal-email";
import { resolveCustomerFacingBusinessName } from "@/lib/proposals/pdf/customer-branding";
import { ensureProposalCustomerAccessToken } from "@/lib/proposals/customer-portal/ensure-token";
import {
  buildCustomerProposalPdfUrl,
  buildCustomerProposalPortalUrl,
} from "@/lib/proposals/customer-portal/token";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { formatSlotLabel } from "@/lib/proposals/revision/conversation-agreements";
import {
  generateFreshProposalPdfBuffer,
  loadProposalPdfContext,
} from "@/lib/proposals/load-proposal-pdf";
import {
  buildProposalEmailCopy,
  buildProposalEmailEvent,
  canSendProposalEmail,
  completeProposalEmailDelivery,
  resolveProposalEmailSendKind,
  type ProposalEmailSendKind,
} from "@/lib/proposals/proposal-email-delivery";
import { normalizeProposalStatus } from "@/lib/proposals/status";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SendProposalToCustomerDeps = {
  sendEmail?: typeof sendProposalEmail;
};

export type SendProposalToCustomerResult =
  | {
      ok: true;
      messageId: string;
      recipient: string;
      portalUrl: string;
      attachedPdf: true;
    }
  | { ok: false; error: string; emailSent: false };

export async function sendProposalToCustomer(
  supabase: SupabaseClient,
  input: {
    proposalId: string;
    userId: string;
    userEmail?: string | null;
    customerEmail?: string | null;
    subject?: string | null;
    message?: string | null;
    kind?: ProposalEmailSendKind;
  },
  deps: SendProposalToCustomerDeps = {}
): Promise<SendProposalToCustomerResult> {
  const sendEmail = deps.sendEmail ?? sendProposalEmail;

  const context = await loadProposalPdfContext(
    supabase,
    input.proposalId,
    input.userId
  );
  if (!context.ok) {
    return { ok: false, error: context.error, emailSent: false };
  }

  const { proposal, workspace, workspaceId } = context;
  const status = normalizeProposalStatus(proposal.status);

  if (!canSendProposalEmail(status)) {
    return {
      ok: false,
      error: "This proposal cannot be emailed in its current state.",
      emailSent: false,
    };
  }

  let recipient = (input.customerEmail || proposal.customer_email || "").trim();
  if (!recipient && proposal.customer_id) {
    const { data: linkedCustomer } = await supabase
      .from("customers")
      .select("email")
      .eq("id", proposal.customer_id)
      .maybeSingle();
    recipient = linkedCustomer?.email?.trim() || "";
  }
  if (!recipient) {
    return {
      ok: false,
      error:
        "No email address has been saved for this customer. Add one before sending.",
      emailSent: false,
    };
  }
  if (!EMAIL_PATTERN.test(recipient)) {
    return {
      ok: false,
      error: "Please enter a valid customer email address.",
      emailSent: false,
    };
  }

  const tokenResult = await ensureProposalCustomerAccessToken(
    supabase,
    input.proposalId
  );
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error, emailSent: false };
  }
  const portalUrl = buildCustomerProposalPortalUrl(tokenResult.token);
  const pdfUrl = buildCustomerProposalPdfUrl(tokenResult.token);
  const kind = resolveProposalEmailSendKind(status, input.kind);
  const businessName = resolveCustomerFacingBusinessName(workspace.business_name);
  const defaults = buildProposalEmailCopy({
    customerName: proposal.customer_name,
    businessName,
    portalUrl,
    kind,
  });
  const subject = input.subject?.trim() || defaults.subject;
  const rawMessage = input.message?.trim() || defaults.message;
  const message = /\/p\/[A-Za-z0-9]+/.test(rawMessage)
    ? rawMessage
    : `${rawMessage}\n\nView your proposal:\n${portalUrl}`;
  const proposedDateLabel =
    formatSlotLabel({
      dateIso: proposal.planned_start_date,
      dateText: proposal.planned_start_date_text,
    }) || proposal.planned_start_date_text?.trim() || null;
  const scopeSummary =
    proposal.job_summary?.trim() ||
    proposal.scope_of_work?.trim()?.split("\n")[0] ||
    null;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateFreshProposalPdfBuffer(proposal, workspace);
  } catch (error) {
    console.error("Failed to generate proposal PDF for email:", error);
    return {
      ok: false,
      error: "Could not generate the proposal PDF. Please try again.",
      emailSent: false,
    };
  }

  const providerResult = await sendEmail({
    to: recipient,
    subject,
    message,
    pdfBuffer,
    replyTo: workspace.contact_email,
    businessName,
    ctaUrl: portalUrl,
    ctaLabel: "View proposal",
    pdfUrl,
    title:
      proposal.job_summary?.trim()?.split("\n")[0] ||
      `Proposal ${proposal.proposal_number}`,
    priceLabel: formatPenceAsGbp(proposal.total_amount),
    proposedDateLabel,
    scopeSummary,
  });

  const delivery = completeProposalEmailDelivery(providerResult);
  if (!delivery.sent) {
    return { ok: false, error: delivery.error, emailSent: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", input.userId)
    .maybeSingle();
  const senderName =
    profile?.full_name?.trim() || input.userEmail?.trim() || "Reanvil user";
  const sentAt = new Date().toISOString();
  const event = buildProposalEmailEvent({
    recipientEmail: recipient,
    subject,
    senderName,
    messageId: delivery.messageId,
    portalUrl,
    kind,
  });

  const update =
    kind === "reminder"
      ? { sent_at: sentAt }
      : {
          status: "waiting_for_customer",
          sent_at: sentAt,
          customer_email: recipient,
          attention_reason: null,
        };

  const { error: updateError } = await supabase
    .from("proposals")
    .update(update)
    .eq("id", input.proposalId);

  if (updateError) {
    console.error("Proposal status update failed after email send:", updateError);
    return {
      ok: false,
      error:
        "The email was sent, but Reanvil could not update the proposal status. Please refresh and check the proposal.",
      emailSent: false,
    };
  }

  const { error: eventError } = await supabase.from("proposal_status_events").insert({
    workspace_id: workspaceId,
    proposal_id: input.proposalId,
    event_type: event.eventType,
    from_status: status,
    to_status: kind === "reminder" ? status : "waiting_for_customer",
    note: event.note,
    metadata: event.metadata,
    created_by: input.userId,
    created_at: sentAt,
  });

  if (eventError) {
    console.error("Failed to record proposal email event:", eventError);
  }

  return {
    ok: true,
    messageId: delivery.messageId,
    recipient,
    portalUrl,
    attachedPdf: true,
  };
}
