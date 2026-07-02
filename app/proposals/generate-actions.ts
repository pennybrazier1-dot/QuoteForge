"use server";

import { generateProposal } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { formatPersonName } from "@/lib/text/format-name";
import type { GeneratedProposal } from "@/lib/ai";

export type GenerateProposalState = {
  error?: string;
  proposal?: GeneratedProposal;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function generateProposalDraft(
  _prevState: GenerateProposalState,
  formData: FormData
): Promise<GenerateProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to generate a proposal." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before generating proposals." };
  }

  const customerName = formatPersonName(getString(formData, "customerName"));
  const siteNotes = getString(formData, "jobDescription");
  const optionalExtras = String(formData.get("optionalExtras") ?? "").trim();
  const estimatedPrice = getString(formData, "estimatedPrice");
  const estimatedDuration = getString(formData, "estimatedDuration");

  if (!siteNotes) {
    return {
      error: "Please add site notes before generating a proposal.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Could not find your workspace. Please try again." };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("business_name, trade_type, default_payment_terms")
    .eq("id", profile.workspace_id)
    .single();

  if (workspaceError || !workspace) {
    return { error: "Could not load your business details. Please try again." };
  }

  try {
    const proposal = await generateProposal({
      tradeType: workspace.trade_type,
      businessName: workspace.business_name,
      customerName,
      siteNotes,
      optionalExtrasNotes: optionalExtras || null,
      estimatedDuration: estimatedDuration || null,
      estimatedPrice: estimatedPrice || null,
      defaultPaymentTerms: workspace.default_payment_terms,
    });

    return { proposal };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not generate a proposal. Please try again.";

    return { error: message };
  }
}
