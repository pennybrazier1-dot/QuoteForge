import OpenAI from "openai";
import {
  VISIT_NOTES_ORGANISE_SYSTEM_PROMPT,
  VISIT_NOTES_ORGANISED_JSON_SCHEMA,
  buildVisitNotesOrganiseUserPrompt,
  parseVisitNotesOrganised,
  type VisitNotesOrganised,
} from "@/lib/visits/organise-visit-notes";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured.");
  }
  return new OpenAI({ apiKey });
}

/**
 * Organise messy visit notes into review sections (same AI stack as Quick Quote).
 * Does not create a proposal.
 */
export async function organiseVisitNotesWithAi(
  notes: string
): Promise<VisitNotesOrganised> {
  const cleaned = notes.trim();
  if (!cleaned) {
    throw new Error("Add visit notes before organising them.");
  }

  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: VISIT_NOTES_ORGANISE_SYSTEM_PROMPT },
      { role: "user", content: buildVisitNotesOrganiseUserPrompt(cleaned) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "organised_visit_notes",
        strict: true,
        schema: VISIT_NOTES_ORGANISED_JSON_SCHEMA,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI did not return organised notes. Please try again.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned an invalid response. Please try again.");
  }

  return parseVisitNotesOrganised(parsed);
}
