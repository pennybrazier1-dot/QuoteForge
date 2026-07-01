import OpenAI from "openai";
import {
  addQualifierConfirmations,
  enrichWithSourceQualifiers,
  preserveQualifiedDuration,
  preserveQualifiedLabour,
  preserveQualifiedStringList,
} from "./qualifiers";
import {
  buildProposalUserPrompt,
  DURATION_CANNOT_DETERMINE_MESSAGE,
  PROPOSAL_SYSTEM_PROMPT,
} from "./prompts";
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
  const scopeOfWork = preserveQualifiedStringList(proposal.scopeOfWork, siteNotes);
  const materials = preserveQualifiedStringList(proposal.materials, siteNotes);
  const labour = preserveQualifiedLabour(
    proposal.labour,
    siteNotes,
    input.estimatedPrice
  );
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

function normalizeGeneratedProposal(
  proposal: GeneratedProposal,
  input: GenerateProposalInput
): GeneratedProposal {
  return normalizeEstimatedDuration(preserveQualifiedLanguage(proposal, input));
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
