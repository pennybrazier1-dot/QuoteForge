import { classifyChangeRequestLabels } from "@/lib/proposals/change-request/analyze-change-request";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import type {
  RevisedProposalFieldKey,
  RevisionSuggestion,
  RevisionSuggestionConfidence,
  RevisionSuggestionType,
} from "@/lib/proposals/revision/types";

const DATE_VALUE_PATTERN =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{2,4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|next week|this week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const PRICE_VALUE_PATTERN = /£\s*\d[\d,]*(?:\.\d{2})?|\b\d+\s*(?:pounds?|quid)\b/i;

const DURATION_PATTERN =
  /\b(\d+\s*(?:day|days|week|weeks)|longer|shorter|how long|duration|take longer|extra day)\b/i;

const EXTRA_WORK_PATTERN =
  /\b(also|extra work|additional|as well|can you also|include|add on|on top)\b/i;

function quoteForEvidence(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 180) {
    return cleaned;
  }
  return `${cleaned.slice(0, 177).trimEnd()}…`;
}

function targetFieldFor(
  type: RevisionSuggestionType
): RevisedProposalFieldKey | null {
  switch (type) {
    case "scope":
      return "scope_of_work";
    case "materials":
      return "materials";
    case "extra_work":
      return "ai_optional_extras";
    case "price":
      return "total_amount";
    case "duration":
      return "estimated_duration";
    case "start_date":
      return "planned_start";
    case "details":
      return "things_to_confirm";
  }
}

function suggestedChangeFor(
  type: RevisionSuggestionType,
  quote: string,
  extracted: string | null
): string {
  switch (type) {
    case "scope":
      return extracted
        ? `Update the scope of work to reflect: “${extracted}”.`
        : `Review and update the scope of work based on: “${quote}”.`;
    case "materials":
      return extracted
        ? `Update materials to reflect: “${extracted}”.`
        : `Review and update materials based on: “${quote}”.`;
    case "extra_work":
      return `Consider adding extra work mentioned in: “${quote}”.`;
    case "price":
      return extracted
        ? `Review the price impact. Customer mentioned ${extracted}. Do not change the price until you confirm.`
        : `Review whether the price still works based on: “${quote}”. Do not change the price until you confirm.`;
    case "duration":
      return extracted
        ? `Review estimated duration (${extracted}) based on the conversation.`
        : `Review estimated duration based on: “${quote}”.`;
    case "start_date":
      return extracted
        ? `Consider updating the planned start to “${extracted}” after you check availability. Calendar is not updated automatically.`
        : `Review the start date request: “${quote}”. Calendar is not updated automatically.`;
    case "details":
      return `Capture this detail on the proposal if needed: “${quote}”.`;
  }
}

function typesFromMessage(body: string): RevisionSuggestionType[] {
  const labels = classifyChangeRequestLabels(body);
  const types = new Set<RevisionSuggestionType>();

  for (const label of labels) {
    switch (label) {
      case "scope":
        types.add("scope");
        break;
      case "materials":
        types.add("materials");
        break;
      case "price":
        types.add("price");
        break;
      case "date":
        types.add("start_date");
        break;
      case "question":
        types.add("details");
        break;
    }
  }

  if (EXTRA_WORK_PATTERN.test(body) && (types.has("scope") || labels.includes("scope"))) {
    types.add("extra_work");
  } else if (EXTRA_WORK_PATTERN.test(body) && !types.has("materials")) {
    types.add("extra_work");
  }

  if (DURATION_PATTERN.test(body)) {
    types.add("duration");
  }

  // Standalone "question" with no other signal stays details only.
  if (types.size === 0) {
    types.add("details");
  }

  // Pure questions without other labels shouldn't also force unrelated types.
  if (labels.length === 1 && labels[0] === "question") {
    return ["details"];
  }

  return Array.from(types);
}

function confidenceFor(
  type: RevisionSuggestionType,
  body: string
): { confidence: RevisionSuggestionConfidence; needsReview: boolean; extracted: string | null } {
  if (type === "price") {
    const match = body.match(PRICE_VALUE_PATTERN);
    return {
      confidence: match ? "medium" : "low",
      needsReview: true,
      extracted: match?.[0]?.trim() ?? null,
    };
  }

  if (type === "start_date") {
    const match = body.match(DATE_VALUE_PATTERN);
    return {
      confidence: match ? "high" : "medium",
      needsReview: !match,
      extracted: match?.[0]?.trim() ?? null,
    };
  }

  if (type === "duration") {
    const match = body.match(DURATION_PATTERN);
    return {
      confidence: match ? "medium" : "low",
      needsReview: true,
      extracted: match?.[0]?.trim() ?? null,
    };
  }

  if (type === "details") {
    return { confidence: "low", needsReview: true, extracted: null };
  }

  return { confidence: "medium", needsReview: false, extracted: null };
}

/**
 * Builds review-only revision suggestions from conversation history.
 * Heuristic for 50C.1 — never mutates proposals.
 */
export function buildRevisionSuggestions(
  messages: ProposalCustomerMessage[]
): RevisionSuggestion[] {
  const customerMessages = messages.filter(
    (message) =>
      message.direction !== "trader" &&
      message.kind !== "trader_reply" &&
      message.body.trim().length > 0
  );

  const suggestions: RevisionSuggestion[] = [];
  let counter = 0;

  for (const message of customerMessages) {
    const quote = quoteForEvidence(message.body);
    const types = typesFromMessage(message.body);

    for (const type of types) {
      const { confidence, needsReview, extracted } = confidenceFor(
        type,
        message.body
      );
      counter += 1;
      suggestions.push({
        id: `rev-${message.id}-${type}-${counter}`,
        type,
        evidenceQuote: quote,
        evidenceMessageId: message.id,
        suggestedChange: suggestedChangeFor(type, quote, extracted),
        confidence,
        needsReview,
        targetField: targetFieldFor(type),
      });
    }
  }

  return suggestions;
}

export function formatRevisionSuggestionType(
  type: RevisionSuggestionType
): string {
  switch (type) {
    case "scope":
      return "Scope";
    case "materials":
      return "Materials";
    case "extra_work":
      return "Extra work";
    case "price":
      return "Price";
    case "duration":
      return "Duration";
    case "start_date":
      return "Start date";
    case "details":
      return "Details";
  }
}

export function formatRevisionConfidence(
  confidence: RevisionSuggestionConfidence
): string {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}
