"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { parsePriceToPence } from "@/lib/proposals/money";
import {
  linesFromMultiline,
  validateRevisionPricing,
} from "@/lib/proposals/revision/validate-revision-pricing";
import { canReviseProposalStatus } from "@/lib/proposals/revision/unsent-revision";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type SaveProposalRevisionState = {
  error?: string;
  ok?: boolean;
  revisionNumber?: number;
  previousTotalPence?: number;
  newTotalPence?: number;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

type SaveRevisionRpcResult = {
  ok?: boolean;
  error?: string;
  revision_number?: number;
  content_revision?: number;
  previous_total_amount?: number;
  new_total_amount?: number;
};

/**
 * Atomically saves a revised proposal via Postgres RPC.
 * Does not send email or unlock customer acceptance (unsent_revision_at remains set).
 */
export async function saveProposalRevision(
  _prev: SaveProposalRevisionState,
  formData: FormData
): Promise<SaveProposalRevisionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to revise a proposal." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = getString(formData, "proposalId");
  const expectedRaw = getString(formData, "expectedContentRevision");
  const expectedContentRevision = Number.parseInt(expectedRaw, 10);
  const totalInput = getString(formData, "totalAmount");
  const scopeOfWork = getString(formData, "scopeOfWork");
  const jobSummary = getString(formData, "jobSummary");
  const labourDescription = getString(formData, "labourDescription");
  const materialsText = getString(formData, "materials");
  const labourText = getString(formData, "labour");
  const changeNotes = getString(formData, "changeNotes");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }

  if (!Number.isFinite(expectedContentRevision) || expectedContentRevision < 0) {
    return { error: "Missing expected revision version. Refresh and try again." };
  }

  const totalPence = parsePriceToPence(totalInput);
  if (totalPence === null) {
    return { error: "Please enter a valid revised total." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, content_revision, vat_amount, total_amount, unsent_revision_at"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  const status = normalizeProposalStatus(proposal.status);
  if (!canReviseProposalStatus(status)) {
    return {
      error: "Only proposals that need attention can be revised right now.",
    };
  }

  if (proposal.content_revision !== expectedContentRevision) {
    return {
      error: "This proposal was updated elsewhere. Refresh and try again.",
    };
  }

  const pricing = validateRevisionPricing({
    totalPence,
    existingVatPence: Number(proposal.vat_amount ?? 0),
  });
  if (!pricing.ok) {
    return { error: pricing.error };
  }

  const materials = linesFromMultiline(materialsText);
  const labour = linesFromMultiline(labourText);

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "save_proposal_revision",
    {
      p_proposal_id: proposalId,
      p_expected_content_revision: expectedContentRevision,
      p_scope_of_work: scopeOfWork,
      p_job_summary: jobSummary,
      p_materials: materials,
      p_labour: labour,
      p_labour_description: labourDescription,
      p_subtotal_amount: pricing.subtotalPence,
      p_vat_amount: pricing.vatPence,
      p_total_amount: pricing.totalPence,
      p_change_notes: changeNotes,
    }
  );

  if (rpcError) {
    return {
      error: rpcError.message || "Could not save the revised proposal.",
    };
  }

  const result = (rpcData ?? {}) as SaveRevisionRpcResult;
  if (!result.ok) {
    return {
      error: result.error || "Could not save the revised proposal.",
    };
  }

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/proposals/${proposalId}/revise`);
  revalidatePath("/dashboard");
  revalidatePath("/proposals");

  return {
    ok: true,
    revisionNumber: result.revision_number,
    previousTotalPence: result.previous_total_amount,
    newTotalPence: result.new_total_amount,
  };
}
