"use server";

import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { parsePriceToPence } from "@/lib/proposals/money";
import { redirect } from "next/navigation";

export type SaveDraftProposalState = {
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function saveDraftProposal(
  _prevState: SaveDraftProposalState,
  formData: FormData
): Promise<SaveDraftProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to save a proposal." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before saving proposals." };
  }

  const customerName = getString(formData, "customerName");
  const propertyAddress = getString(formData, "propertyAddress");
  const phoneNumber = getString(formData, "phoneNumber");
  const emailAddress = getString(formData, "emailAddress");
  const jobDescription = getString(formData, "jobDescription");
  const estimatedPrice = getString(formData, "estimatedPrice");
  const estimatedDuration = getString(formData, "estimatedDuration");

  if (!customerName) {
    return { error: "Customer name is required." };
  }

  if (!jobDescription) {
    return { error: "Please describe today's job before saving." };
  }

  if (emailAddress && !isValidEmail(emailAddress)) {
    return { error: "Please enter a valid email address." };
  }

  const totalPence = parsePriceToPence(estimatedPrice);
  if (totalPence === null) {
    return { error: "Please enter a valid estimated price." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Could not find your workspace. Please try again." };
  }

  const workspaceId = profile.workspace_id;

  let customerId: string | null = null;

  if (emailAddress) {
    const { data: existingByEmail } = await supabase
      .from("customers")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("email", emailAddress)
      .maybeSingle();

    customerId = existingByEmail?.id ?? null;
  }

  if (!customerId) {
    const { data: existingByName } = await supabase
      .from("customers")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", customerName)
      .maybeSingle();

    customerId = existingByName?.id ?? null;
  }

  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        workspace_id: workspaceId,
        name: customerName,
        email: emailAddress || null,
        phone: phoneNumber || null,
        address_line_1: propertyAddress || null,
      })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      return {
        error: customerError?.message ?? "Could not save customer details.",
      };
    }

    customerId = newCustomer.id;
  }

  const { data: proposalNumber, error: numberError } = await supabase.rpc(
    "allocate_proposal_number",
    { target_workspace_id: workspaceId }
  );

  if (numberError || !proposalNumber) {
    return {
      error: numberError?.message ?? "Could not allocate a proposal number.",
    };
  }

  const thingsToConfirm = estimatedDuration
    ? `Estimated duration: ${estimatedDuration}`
    : null;

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      workspace_id: workspaceId,
      customer_id: customerId,
      proposal_number: proposalNumber,
      status: "draft",
      title: `Proposal for ${customerName}`,
      job_address: propertyAddress || null,
      rough_notes: jobDescription,
      things_to_confirm: thingsToConfirm,
      customer_name: customerName,
      customer_email: emailAddress || null,
      customer_phone: phoneNumber || null,
      customer_address: propertyAddress || null,
      subtotal_amount: totalPence,
      vat_amount: 0,
      total_amount: totalPence,
    })
    .select("id")
    .single();

  if (proposalError || !proposal) {
    return {
      error: proposalError?.message ?? "Could not save your proposal.",
    };
  }

  redirect(`/proposals/${proposal.id}`);
}
