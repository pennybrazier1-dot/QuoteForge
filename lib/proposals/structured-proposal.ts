import type { GeneratedProposal } from "@/lib/ai";

export type StructuredProposalData = {
  jobSummary: string;
  scopeOfWork: string[];
  materials: string[];
  labour: string;
  estimatedDuration: string;
  thingsToConfirm: string[];
  optionalExtras: string[];
  paymentTerms: string;
};

export function hasStructuredProposal(proposal: {
  job_summary?: string | null;
}): boolean {
  return Boolean(proposal.job_summary?.trim());
}

export function mapGeneratedProposalToStructuredData(
  proposal: GeneratedProposal
): StructuredProposalData {
  return {
    jobSummary: proposal.jobSummary,
    scopeOfWork: proposal.scopeOfWork,
    materials: proposal.materials,
    labour: proposal.labour,
    estimatedDuration: proposal.estimatedDuration,
    thingsToConfirm: proposal.thingsToConfirm,
    optionalExtras: proposal.optionalExtras,
    paymentTerms: proposal.paymentTerms,
  };
}

export function mapGeneratedProposalToDbFields(proposal: GeneratedProposal) {
  return {
    job_summary: proposal.jobSummary,
    scope_of_work: proposal.scopeOfWork.join("\n"),
    materials: proposal.materials,
    labour_description: proposal.labour,
    estimated_duration: proposal.estimatedDuration,
    things_to_confirm_items: proposal.thingsToConfirm,
    ai_optional_extras: proposal.optionalExtras,
    payment_terms: proposal.paymentTerms,
  };
}

export function mapDbRowToStructuredProposal(proposal: {
  job_summary: string | null;
  scope_of_work: string | null;
  materials: unknown;
  labour_description: string | null;
  estimated_duration: string | null;
  things_to_confirm_items: unknown;
  ai_optional_extras: unknown;
  payment_terms: string | null;
}): StructuredProposalData | null {
  if (!proposal.job_summary?.trim()) {
    return null;
  }

  return {
    jobSummary: proposal.job_summary,
    scopeOfWork: parseStringArrayField(proposal.scope_of_work),
    materials: parseJsonStringArray(proposal.materials),
    labour: proposal.labour_description ?? "",
    estimatedDuration: proposal.estimated_duration ?? "",
    thingsToConfirm: parseJsonStringArray(proposal.things_to_confirm_items),
    optionalExtras: parseJsonStringArray(proposal.ai_optional_extras),
    paymentTerms: proposal.payment_terms ?? "",
  };
}

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseStringArrayField(value: string | null): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseGeneratedProposalJson(
  value: string
): GeneratedProposal | null {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as GeneratedProposal;

    if (
      !parsed ||
      typeof parsed.jobSummary !== "string" ||
      !Array.isArray(parsed.scopeOfWork) ||
      !Array.isArray(parsed.materials) ||
      typeof parsed.labour !== "string" ||
      typeof parsed.estimatedDuration !== "string" ||
      !Array.isArray(parsed.thingsToConfirm) ||
      !Array.isArray(parsed.optionalExtras) ||
      typeof parsed.paymentTerms !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
