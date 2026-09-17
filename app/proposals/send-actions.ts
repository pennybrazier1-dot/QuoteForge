"use server";

import { revalidatePath } from "next/cache";
import { sendProposalToCustomer } from "@/lib/proposals/send-proposal-to-customer";
import { createClient } from "@/lib/supabase/server";

export type SendProposalByEmailState = {
  success?: boolean;
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

  const result = await sendProposalToCustomer(supabase, {
    proposalId,
    userId: user.id,
    userEmail: user.email,
    customerEmail,
    subject,
    message,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);

  return { success: true };
}
