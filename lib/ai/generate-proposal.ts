import OpenAI from "openai";
import {
  addQualifierConfirmations,
  enrichWithSourceQualifiers,
  preserveQualifiedDuration,
  preserveQualifiedScopeItems,
} from "./qualifiers";
import { sanitizeGeneratedProposal } from "./sanitize-proposal";
import { logProposalPipelineStage } from "./proposal-debug";
import {
  buildProposalUserPrompt,
  DURATION_CANNOT_DETERMINE_MESSAGE,
  PROPOSAL_SYSTEM_PROMPT,
} from "./prompts";
import {
  CONFIRM_PLANNED_START_DATE,
  formatPlannedStartExact,
  normalizePlannedStartExact,
} from "@/lib/proposals/planned-start-date";
import {
  GENERATED_PROPOSAL_JSON_SCHEMA,
  type GenerateProposalInput,
  type GeneratedProposal,
} from "./types";

const UNCERTAIN_DURATION_PATTERNS = [
  /needs?\s+confirm/i,
  /to be confirmed/i,
  /\btbc\b/i,
  /confirm(?:ation)?\s+(?:of\s+)?duration/i,
  /duration\s+(?:to be\s+)?confirm/i,
  /not\s+(?:yet\s+)?(?:known|provided|specified)/i,
];

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  return new OpenAI({ apiKey });
}

function parseGeneratedProposal(content: string): GeneratedProposal {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned an invalid response. Please try again.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned an invalid response. Please try again.");
  }

  return parsed as GeneratedProposal;
}

function normalizeEstimatedDuration(
  proposal: GeneratedProposal
): GeneratedProposal {
  const duration = proposal.estimatedDuration.trim();
  const isUncertain =
    duration.length === 0 ||
    UNCERTAIN_DURATION_PATTERNS.some((pattern) => pattern.test(duration));

  if (!isUncertain) {
    return proposal;
  }

  const durationConfirmItem =
    "Estimated duration for the work once full scope is confirmed";
  const thingsToConfirm = proposal.thingsToConfirm.includes(durationConfirmItem)
    ? proposal.thingsToConfirm
    : [...proposal.thingsToConfirm, durationConfirmItem];

  return {
    ...proposal,
    estimatedDuration: DURATION_CANNOT_DETERMINE_MESSAGE,
    thingsToConfirm,
  };
}

function preserveQualifiedLanguage(
  proposal: GeneratedProposal,
  input: GenerateProposalInput
): GeneratedProposal {
  const siteNotes = input.siteNotes;

  const jobSummary = enrichWithSourceQualifiers(proposal.jobSummary, siteNotes);
  const scopeOfWork = preserveQualifiedScopeItems(proposal.scopeOfWork, siteNotes);
  const materials = proposal.materials.map((item) => item.trim()).filter(Boolean);
  const labour = proposal.labour.trim();
  const estimatedDuration = preserveQualifiedDuration(
    proposal.estimatedDuration,
    siteNotes,
    input.estimatedDuration
  );

  const proposalText = [
    jobSummary,
    ...scopeOfWork,
    ...materials,
    labour,
    estimatedDuration,
  ].join(" ");

  const thingsToConfirm = addQualifierConfirmations(
    proposal.thingsToConfirm,
    siteNotes,
    proposalText
  );

  return {
    ...proposal,
    jobSummary,
    scopeOfWork,
    materials,
    labour,
    estimatedDuration,
    thingsToConfirm,
  };
}

function normalizePlannedStartDate(
  proposal: GeneratedProposal
): GeneratedProposal {
  const text = proposal.plannedStartDate.trim();
  const exact = normalizePlannedStartExact(proposal.plannedStartDateExact) ?? "";

  if (!text && !exact) {
    return {
      ...proposal,
      plannedStartDate: "",
      plannedStartDateExact: "",
    };
  }

  let plannedStartDate = text;
  const plannedStartDateExact = exact;

  if (plannedStartDateExact && !plannedStartDate) {
    plannedStartDate = formatPlannedStartExact(plannedStartDateExact);
  }

  const isVague = Boolean(plannedStartDate) && !plannedStartDateExact;
  let thingsToConfirm = proposal.thingsToConfirm;

  if (isVague) {
    const hasStartConfirm = thingsToConfirm.some((item) =>
      /planned start|start date/i.test(item)
    );

    if (!hasStartConfirm) {
      thingsToConfirm = [...thingsToConfirm, CONFIRM_PLANNED_START_DATE];
    }
  }

  return {
    ...proposal,
    plannedStartDate,
    plannedStartDateExact,
    thingsToConfirm,
  };
}

function normalizeGeneratedProposal(
  proposal: GeneratedProposal,
  input: GenerateProposalInput
): GeneratedProposal {
  logProposalPipelineStage("raw AI response", proposal);

  const afterQualifiers = normalizePlannedStartDate(
    normalizeEstimatedDuration(preserveQualifiedLanguage(proposal, input))
  );
  logProposalPipelineStage("after qualifier preservation", afterQualifiers);

  const sanitized = sanitizeGeneratedProposal(
    afterQualifiers,
    input.siteNotes,
    input.estimatedPrice,
    input.estimatedDuration
  );
  logProposalPipelineStage("after sanitization", sanitized);

  return sanitized;
}

export async function generateProposal(
  input: GenerateProposalInput
): Promise<GeneratedProposal> {
  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: PROPOSAL_SYSTEM_PROMPT },
      { role: "user", content: buildProposalUserPrompt(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "generated_proposal",
        strict: true,
        schema: GENERATED_PROPOSAL_JSON_SCHEMA,
      },
    },
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI did not return a proposal. Please try again.");
  }

  return normalizeGeneratedProposal(parseGeneratedProposal(content), input);
}
