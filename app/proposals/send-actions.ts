"use server";

import { revalidatePath } from "next/cache";
import { sendProposalEmail } from "@/lib/email/send-proposal-email";
import {
  devTestingDisabledMessage,
  isDevTestingEnabled,
} from "@/lib/env/dev-testing";
import {
  generateFreshProposalPdfBuffer,
  loadProposalPdfContext,
} from "@/lib/proposals/load-proposal-pdf";
import { executeSimulatedSend } from "@/lib/proposals/simulated-send";
import { createClient } from "@/lib/supabase/server";

export type SendProposalByEmailState = {
  success?: boolean;
  simulated?: boolean;
  message?: string;
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Single entry point for Send and Test Send from the proposal dialog.
 * Branch on qfSendMode before any Resend/PDF work runs.
 */
export async function handleProposalSend(
  _prevState: SendProposalByEmailState,
  formData: FormData
): Promise<SendProposalByEmailState> {
  const sendMode = getString(formData, "qfSendMode");

  console.log(
    "[QuoteForge] handleProposalSend called — qfSendMode=%s",
    sendMode || "(missing)"
  );

  if (sendMode === "simulated") {
    console.log("[QuoteForge] handleProposalSend → simulateSendProposal path");

    if (!isDevTestingEnabled()) {
      return { error: devTestingDisabledMessage() };
    }

    const supabase = await createClient();

    return executeSimulatedSend(supabase, formData);
  }

  console.log("[QuoteForge] handleProposalSend → sendProposalByEmail path");

  return sendProposalByEmail(_prevState, formData);
}

/** Real email send — only called when qfSendMode is not "simulated". */
export async function sendProposalByEmail(
  _prevState: SendProposalByEmailState,
  formData: FormData
): Promise<SendProposalByEmailState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to send a proposal." };
  }

  const proposalId = getString(formData, "proposalId");
  const customerEmail = getString(formData, "customerEmail");
  const subject = getString(formData, "subject");
  const message = getString(formData, "message");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!customerEmail) {
    return {
      error: "No email address has been saved for this customer. Add one before sending.",
    };
  }

  if (!isValidEmail(customerEmail)) {
    return { error: "Please enter a valid customer email address." };
  }

  if (!subject) {
    return { error: "Please enter an email subject." };
  }

  if (!message) {
    return { error: "Please enter an email message." };
  }

  const context = await loadProposalPdfContext(supabase, proposalId, user.id);

  if (!context.ok) {
    return { error: context.error };
  }

  const { proposal, workspace, workspaceId } = context;

  if (proposal.status !== "ready_to_send") {
    return {
      error: "Only proposals that are ready to send can be emailed to customers.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const senderName = profile?.full_name?.trim() || user.email || "QuoteForge user";
  const sentAt = new Date().toISOString();

  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await generateFreshProposalPdfBuffer(proposal, workspace);
  } catch (error) {
    console.error("Failed to generate proposal PDF for email:", error);
    return { error: "Could not generate the proposal PDF. Please try again." };
  }

  const emailResult = await sendProposalEmail({
    to: customerEmail,
    subject,
    message,
    pdfBuffer,
    replyTo: workspace.contact_email,
    businessName: workspace.business_name,
  });

  if (!emailResult.ok) {
    return { error: emailResult.error };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: "waiting_for_customer",
      sent_at: sentAt,
      customer_email: customerEmail,
    })
    .eq("id", proposalId)
    .eq("status", "ready_to_send");

  if (updateError) {
    console.error("Proposal status update failed after email send:", updateError);
    return {
      error:
        "The email was sent, but QuoteForge could not update the proposal status. Please refresh and check the proposal.",
    };
  }

  const { error: eventError } = await supabase.from("proposal_status_events").insert({
    workspace_id: workspaceId,
    proposal_id: proposalId,
    event_type: "emailed",
    from_status: "ready_to_send",
    to_status: "waiting_for_customer",
    note: `Proposal emailed to ${customerEmail}`,
    metadata: {
      recipient_email: customerEmail,
      subject,
      sender_name: senderName,
      provider: "resend",
      provider_message_id: emailResult.messageId,
    },
    created_by: user.id,
    created_at: sentAt,
  });

  if (eventError) {
    console.error("Failed to record proposal email event:", eventError);
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);

  return { success: true };
}
