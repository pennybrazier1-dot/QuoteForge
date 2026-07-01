"use server";

import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { buildEstimatedDurationNote } from "@/lib/proposals/duration";
import { parseOptionalExtrasForStorage } from "@/lib/proposals/optional-extras";
import { parsePriceToPence } from "@/lib/proposals/money";
import {
  mapGeneratedProposalToDbFields,
  parseGeneratedProposalJson,
} from "@/lib/proposals/structured-proposal";
import { redirect } from "next/navigation";

export type SaveDraftProposalState = {
  error?: string;
};

export type AcceptAiDraftProposalState = {
  error?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type ParsedProposalForm = {
  customerName: string;
  propertyAddress: string;
  phoneNumber: string;
  emailAddress: string;
  jobDescription: string;
  optionalExtras: string;
  estimatedPrice: string;
  estimatedDuration: string;
};

function parseProposalForm(formData: FormData): ParsedProposalForm {
  return {
    customerName: getString(formData, "customerName"),
    propertyAddress: getString(formData, "propertyAddress"),
    phoneNumber: getString(formData, "phoneNumber"),
    emailAddress: getString(formData, "emailAddress"),
    jobDescription: getString(formData, "jobDescription"),
    optionalExtras: String(formData.get("optionalExtras") ?? "").trim(),
    estimatedPrice: getString(formData, "estimatedPrice"),
    estimatedDuration: getString(formData, "estimatedDuration"),
  };
}

function validateProposalForm(
  form: ParsedProposalForm
): SaveDraftProposalState | { ok: true; totalPence: number } {
  if (!form.customerName) {
    return { error: "Customer name is required." };
  }

  if (!form.jobDescription) {
    return { error: "Please add site notes before saving." };
  }

  if (form.emailAddress && !isValidEmail(form.emailAddress)) {
    return { error: "Please enter a valid email address." };
  }

  const totalPence = parsePriceToPence(form.estimatedPrice);
  if (totalPence === null) {
    return { error: "Please enter a valid estimated price." };
  }

  return { ok: true, totalPence };
}

async function resolveCustomerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  form: ParsedProposalForm,
  existingCustomerId: string | null
): Promise<{ customerId: string | null; error?: string }> {
  if (existingCustomerId) {
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        name: form.customerName,
        email: form.emailAddress || null,
        phone: form.phoneNumber || null,
        address_line_1: form.propertyAddress || null,
      })
      .eq("id", existingCustomerId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      return {
        customerId: null,
        error: updateError.message ?? "Could not update customer details.",
      };
    }

    return { customerId: existingCustomerId };
  }

  let customerId: string | null = null;

  if (form.emailAddress) {
    const { data: existingByEmail } = await supabase
      .from("customers")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("email", form.emailAddress)
      .maybeSingle();

    customerId = existingByEmail?.id ?? null;
  }

  if (!customerId) {
    const { data: existingByName } = await supabase
      .from("customers")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", form.customerName)
      .maybeSingle();

    customerId = existingByName?.id ?? null;
  }

  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        workspace_id: workspaceId,
        name: form.customerName,
        email: form.emailAddress || null,
        phone: form.phoneNumber || null,
        address_line_1: form.propertyAddress || null,
      })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      return {
        customerId: null,
        error: customerError?.message ?? "Could not save customer details.",
      };
    }

    customerId = newCustomer.id;
  } else {
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        name: form.customerName,
        email: form.emailAddress || null,
        phone: form.phoneNumber || null,
        address_line_1: form.propertyAddress || null,
      })
      .eq("id", customerId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      return {
        customerId: null,
        error: updateError.message ?? "Could not update customer details.",
      };
    }
  }

  return { customerId };
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

  const form = parseProposalForm(formData);
  const validation = validateProposalForm(form);

  if (!("ok" in validation)) {
    return validation;
  }

  const { totalPence } = validation;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Could not find your workspace. Please try again." };
  }

  const workspaceId = profile.workspace_id;

  const { customerId, error: customerError } = await resolveCustomerId(
    supabase,
    workspaceId,
    form,
    null
  );

  if (customerError || !customerId) {
    return { error: customerError ?? "Could not save customer details." };
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

  const thingsToConfirm = buildEstimatedDurationNote(form.estimatedDuration);
  const optionalExtras = parseOptionalExtrasForStorage(form.optionalExtras);
  const estimatedDuration = form.estimatedDuration || null;

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      workspace_id: workspaceId,
      customer_id: customerId,
      proposal_number: proposalNumber,
      status: "draft",
      title: `Proposal for ${form.customerName}`,
      job_address: form.propertyAddress || null,
      rough_notes: form.jobDescription,
      optional_extras: optionalExtras,
      estimated_duration: estimatedDuration,
      things_to_confirm: thingsToConfirm,
      customer_name: form.customerName,
      customer_email: form.emailAddress || null,
      customer_phone: form.phoneNumber || null,
      customer_address: form.propertyAddress || null,
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

export async function updateDraftProposal(
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

  const proposalId = getString(formData, "proposalId");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  const form = parseProposalForm(formData);
  const validation = validateProposalForm(form);

  if (!("ok" in validation)) {
    return validation;
  }

  const { totalPence } = validation;

  const { data: existingProposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status, customer_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !existingProposal) {
    return { error: "Proposal not found." };
  }

  if (existingProposal.status !== "draft") {
    return { error: "Only draft proposals can be edited." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Could not find your workspace. Please try again." };
  }

  const { customerId, error: customerError } = await resolveCustomerId(
    supabase,
    profile.workspace_id,
    form,
    existingProposal.customer_id
  );

  if (customerError || !customerId) {
    return { error: customerError ?? "Could not save customer details." };
  }

  const thingsToConfirm = buildEstimatedDurationNote(form.estimatedDuration);
  const optionalExtras = parseOptionalExtrasForStorage(form.optionalExtras);
  const estimatedDuration = form.estimatedDuration || null;

  const { error: proposalError } = await supabase
    .from("proposals")
    .update({
      customer_id: customerId,
      title: `Proposal for ${form.customerName}`,
      job_address: form.propertyAddress || null,
      rough_notes: form.jobDescription,
      optional_extras: optionalExtras,
      estimated_duration: estimatedDuration,
      things_to_confirm: thingsToConfirm,
      customer_name: form.customerName,
      customer_email: form.emailAddress || null,
      customer_phone: form.phoneNumber || null,
      customer_address: form.propertyAddress || null,
      subtotal_amount: totalPence,
      vat_amount: 0,
      total_amount: totalPence,
    })
    .eq("id", proposalId);

  if (proposalError) {
    return {
      error: proposalError.message ?? "Could not save your proposal.",
    };
  }

  redirect(`/proposals/${proposalId}`);
}

export async function acceptAiDraftProposal(
  _prevState: AcceptAiDraftProposalState,
  formData: FormData
): Promise<AcceptAiDraftProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to accept a proposal draft." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before saving proposals." };
  }

  const generatedProposal = parseGeneratedProposalJson(
    String(formData.get("generatedProposal") ?? "")
  );

  if (!generatedProposal) {
    return { error: "No AI draft was found. Generate a proposal first." };
  }

  const form = parseProposalForm(formData);
  const validation = validateProposalForm(form);

  if (!("ok" in validation)) {
    return validation;
  }

  const { totalPence } = validation;
  const proposalId = getString(formData, "proposalId");
  const structuredFields = mapGeneratedProposalToDbFields(generatedProposal);
  const optionalExtras = parseOptionalExtrasForStorage(form.optionalExtras);
  const manualDuration = form.estimatedDuration || null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Could not find your workspace. Please try again." };
  }

  const workspaceId = profile.workspace_id;

  if (proposalId) {
    const { data: existingProposal, error: loadError } = await supabase
      .from("proposals")
      .select("id, status, customer_id")
      .eq("id", proposalId)
      .maybeSingle();

    if (loadError || !existingProposal) {
      return { error: "Proposal not found." };
    }

    if (existingProposal.status !== "draft") {
      return { error: "Only draft proposals can be updated." };
    }

    const { customerId, error: customerError } = await resolveCustomerId(
      supabase,
      workspaceId,
      form,
      existingProposal.customer_id
    );

    if (customerError || !customerId) {
      return { error: customerError ?? "Could not save customer details." };
    }

    const { error: proposalError } = await supabase
      .from("proposals")
      .update({
        customer_id: customerId,
        title: `Proposal for ${form.customerName}`,
        job_address: form.propertyAddress || null,
        rough_notes: form.jobDescription,
        optional_extras: optionalExtras,
        customer_name: form.customerName,
        customer_email: form.emailAddress || null,
        customer_phone: form.phoneNumber || null,
        customer_address: form.propertyAddress || null,
        subtotal_amount: totalPence,
        vat_amount: 0,
        total_amount: totalPence,
        ...structuredFields,
        estimated_duration: manualDuration ?? structuredFields.estimated_duration,
        things_to_confirm: buildEstimatedDurationNote(form.estimatedDuration),
      })
      .eq("id", proposalId);

    if (proposalError) {
      return {
        error: proposalError.message ?? "Could not accept the AI draft.",
      };
    }

    redirect(`/proposals/${proposalId}`);
  }

  const { customerId, error: customerError } = await resolveCustomerId(
    supabase,
    workspaceId,
    form,
    null
  );

  if (customerError || !customerId) {
    return { error: customerError ?? "Could not save customer details." };
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

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      workspace_id: workspaceId,
      customer_id: customerId,
      proposal_number: proposalNumber,
      status: "draft",
      title: `Proposal for ${form.customerName}`,
      job_address: form.propertyAddress || null,
      rough_notes: form.jobDescription,
      optional_extras: optionalExtras,
      customer_name: form.customerName,
      customer_email: form.emailAddress || null,
      customer_phone: form.phoneNumber || null,
      customer_address: form.propertyAddress || null,
      subtotal_amount: totalPence,
      vat_amount: 0,
      total_amount: totalPence,
      ...structuredFields,
      estimated_duration: manualDuration ?? structuredFields.estimated_duration,
      things_to_confirm: buildEstimatedDurationNote(form.estimatedDuration),
    })
    .select("id")
    .single();

  if (proposalError || !proposal) {
    return {
      error: proposalError?.message ?? "Could not accept the AI draft.",
    };
  }

  redirect(`/proposals/${proposal.id}`);
}

export type DeleteDraftProposalState = {
  error?: string;
};

export async function deleteDraftProposal(
  _prevState: DeleteDraftProposalState,
  formData: FormData
): Promise<DeleteDraftProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to delete a proposal." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before deleting proposals." };
  }

  const proposalId = getString(formData, "proposalId");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select("id, status")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  if (proposal.status !== "draft") {
    return { error: "Only draft proposals can be deleted." };
  }

  const { error: deleteError } = await supabase
    .from("proposals")
    .delete()
    .eq("id", proposalId);

  if (deleteError) {
    return {
      error: deleteError.message ?? "Could not delete this proposal.",
    };
  }

  redirect("/dashboard");
}
