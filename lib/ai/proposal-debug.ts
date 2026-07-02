import type { GeneratedProposal } from "./types";

const DEBUG_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.QF_DEBUG_PROPOSAL === "1";

type ProposalDebugSlice = Pick<
  GeneratedProposal,
  | "labour"
  | "optionalExtras"
  | "estimatedDuration"
  | "extractedEstimatedPrice"
  | "scopeOfWork"
>;

function sliceForDebug(proposal: GeneratedProposal): ProposalDebugSlice {
  return {
    labour: proposal.labour,
    optionalExtras: proposal.optionalExtras,
    estimatedDuration: proposal.estimatedDuration,
    extractedEstimatedPrice: proposal.extractedEstimatedPrice,
    scopeOfWork: proposal.scopeOfWork,
  };
}

export function logProposalPipelineStage(
  stage: string,
  proposal: GeneratedProposal
): void {
  if (!DEBUG_ENABLED) {
    return;
  }

  console.log(`[QuoteForge proposal] ${stage}`, sliceForDebug(proposal));
}

export function logProposalFormMapping(
  proposal: GeneratedProposal,
  mapped: {
    estimatedPrice: string;
    optionalExtras: string;
  }
): void {
  if (!DEBUG_ENABLED) {
    return;
  }

  console.log("[QuoteForge proposal] form field mapping", {
    extractedEstimatedPrice: proposal.extractedEstimatedPrice,
    mappedEstimatedPrice: mapped.estimatedPrice,
    optionalExtrasFromProposal: proposal.optionalExtras,
    mappedOptionalExtras: mapped.optionalExtras,
    labour: proposal.labour,
  });
}
