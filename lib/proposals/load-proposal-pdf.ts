import type { SupabaseClient } from "@supabase/supabase-js";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  buildProposalPdfData,
  generateProposalPdf,
} from "@/lib/proposals/generate-proposal-pdf";
import {
  PROPOSAL_PDF_SELECT,
  WORKSPACE_PDF_SELECT,
} from "@/lib/proposals/proposal-pdf-select";

export type ProposalPdfSource = {
  id: string;
  proposal_number: string;
  status: string;
  created_at: string;
  customer_name: string | null;
  customer_address: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  rough_notes: string | null;
  optional_extras: unknown;
  things_to_confirm: string | null;
  estimated_duration: string | null;
  payment_terms: string | null;
  total_amount: number;
  job_summary: string | null;
  scope_of_work: string | null;
  materials: unknown;
  labour_description: string | null;
  ai_optional_extras: unknown;
  things_to_confirm_items: unknown;
};

export type WorkspacePdfSource = {
  business_name: string;
  trade_type: string | null;
  contact_email: string | null;
  phone: string | null;
  default_payment_terms: string;
};

type LoadProposalPdfContextResult =
  | {
      ok: true;
      proposal: ProposalPdfSource;
      workspace: WorkspacePdfSource;
      workspaceId: string;
    }
  | { ok: false; error: string };

export async function loadProposalPdfContext(
  supabase: SupabaseClient,
  proposalId: string,
  userId: string
): Promise<LoadProposalPdfContextResult> {
  if (!(await userHasProfile(userId))) {
    return { ok: false, error: "Please complete onboarding before continuing." };
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_PDF_SELECT)
    .eq("id", proposalId)
    .maybeSingle();

  if (proposalError || !proposal) {
    return { ok: false, error: "Proposal not found." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { ok: false, error: "Could not find your workspace." };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select(WORKSPACE_PDF_SELECT)
    .eq("id", profile.workspace_id)
    .single();

  if (workspaceError || !workspace) {
    return { ok: false, error: "Could not find your business details." };
  }

  return {
    ok: true,
    proposal: proposal as ProposalPdfSource,
    workspace: workspace as WorkspacePdfSource,
    workspaceId: profile.workspace_id,
  };
}

export async function generateFreshProposalPdfBuffer(
  proposal: ProposalPdfSource,
  workspace: WorkspacePdfSource
): Promise<Buffer> {
  const pdfData = buildProposalPdfData(proposal, workspace);
  const pdfBuffer = await generateProposalPdf(pdfData);

  if (!pdfBuffer.length) {
    throw new Error("Generated PDF was empty.");
  }

  return pdfBuffer;
}
