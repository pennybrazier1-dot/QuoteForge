import { classifyChangeRequestLabels } from "@/lib/proposals/change-request/analyze-change-request";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  findLatestConfirmedDateAgreement,
  formatAgreementDateLabel,
  isVagueDateWindowOnly,
} from "@/lib/proposals/revision/conversation-agreements";

export type ResolutionRecommendedAction =
  | "update_proposal"
  | "open_calendar"
  | "reply";

export type ConversationResolutionSummary = {
  customerAsked: string;
  whatWasAgreed: string;
  possibleImpact: string;
  recommendedAction: ResolutionRecommendedAction;
  /** Prefill for Open calendar — never auto-saved. */
  plannedStartText: string | null;
  plannedStartExact: string | null;
  hasCustomerMessages: boolean;
};

function isCustomerMessage(message: ProposalCustomerMessage): boolean {
  return message.direction !== "trader" && message.kind !== "trader_reply";
}

function quoteSnippet(body: string, max = 160): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function orderedMessages(
  messages: ProposalCustomerMessage[]
): ProposalCustomerMessage[] {
  return [...messages]
    .filter((message) => message.body.trim().length > 0)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

function buildCustomerAsked(messages: ProposalCustomerMessage[]): string {
  const customer = messages.filter(isCustomerMessage);
  if (customer.length === 0) {
    return "No customer message yet.";
  }

  const changeRequests = customer.filter(
    (message) => message.kind === "change_request"
  );
  const source =
    changeRequests.length > 0 ? changeRequests[0] : customer[0];

  const labels = classifyChangeRequestLabels(source.body);
  const snippet = quoteSnippet(source.body);

  if (isVagueDateWindowOnly(source.body) || labels.includes("date")) {
    if (labels.includes("materials") || labels.includes("scope")) {
      return `They asked about timing and changes to the work: “${snippet}”`;
    }
    return `They asked about timing: “${snippet}”`;
  }

  if (labels.includes("materials") && labels.includes("scope")) {
    return `They asked to change the scope and materials: “${snippet}”`;
  }
  if (labels.includes("materials")) {
    return `They asked about materials: “${snippet}”`;
  }
  if (labels.includes("scope")) {
    return `They asked to change the scope: “${snippet}”`;
  }
  if (labels.includes("price")) {
    return `They asked about price: “${snippet}”`;
  }

  return `They wrote: “${snippet}”`;
}

function buildWhatWasAgreed(
  messages: ProposalCustomerMessage[],
  now: Date
): {
  text: string;
  plannedStartText: string | null;
  plannedStartExact: string | null;
  hasDateAgreement: boolean;
} {
  const agreement = findLatestConfirmedDateAgreement(messages, now);
  if (agreement) {
    const label = formatAgreementDateLabel(agreement);
    return {
      text: `Start date agreed: ${label}.`,
      plannedStartText: label,
      plannedStartExact: agreement.dateIso,
      hasDateAgreement: true,
    };
  }

  const customer = messages.filter(isCustomerMessage);
  const latest = customer[customer.length - 1];
  if (latest?.kind === "question" && /\?/.test(latest.body)) {
    return {
      text: "Nothing firm agreed yet — they may still be waiting on an answer.",
      plannedStartText: null,
      plannedStartExact: null,
      hasDateAgreement: false,
    };
  }

  return {
    text: "No firm agreement recorded yet in this conversation.",
    plannedStartText: null,
    plannedStartExact: null,
    hasDateAgreement: false,
  };
}

function buildPossibleImpact(
  messages: ProposalCustomerMessage[],
  hasDateAgreement: boolean
): string {
  const customerText = messages
    .filter(isCustomerMessage)
    .map((message) => message.body)
    .join("\n");
  const labels = classifyChangeRequestLabels(customerText || " ");
  const impacts: string[] = [];

  if (hasDateAgreement || labels.includes("date")) {
    impacts.push("Timing on the calendar may need updating");
  }
  if (labels.includes("scope") || labels.includes("materials")) {
    impacts.push("Scope or materials on the proposal may need updating");
  }
  if (labels.includes("price")) {
    impacts.push("Price may need a review");
  }
  if (impacts.length === 0) {
    return "You may only need to reply — no proposal change is required yet.";
  }

  return `${impacts.join(". ")}. Nothing changes until you confirm in the right tool.`;
}

function recommendAction(input: {
  hasDateAgreement: boolean;
  messages: ProposalCustomerMessage[];
}): ResolutionRecommendedAction {
  if (input.hasDateAgreement) {
    return "open_calendar";
  }

  const customerText = input.messages
    .filter(isCustomerMessage)
    .map((message) => message.body)
    .join("\n");
  const labels = classifyChangeRequestLabels(customerText || " ");

  if (
    labels.includes("scope") ||
    labels.includes("materials") ||
    labels.includes("price")
  ) {
    return "update_proposal";
  }

  return "reply";
}

/**
 * Plain-language summary for the change-request resolution UI.
 * Prefer final agreements over early vague requests. No AI labels.
 */
export function buildConversationResolutionSummary(
  messages: ProposalCustomerMessage[],
  now: Date = new Date()
): ConversationResolutionSummary {
  const ordered = orderedMessages(messages);
  const customerAsked = buildCustomerAsked(ordered);
  const agreed = buildWhatWasAgreed(ordered, now);
  const possibleImpact = buildPossibleImpact(
    ordered,
    agreed.hasDateAgreement
  );
  const recommendedAction = recommendAction({
    hasDateAgreement: agreed.hasDateAgreement,
    messages: ordered,
  });

  return {
    customerAsked,
    whatWasAgreed: agreed.text,
    possibleImpact,
    recommendedAction,
    plannedStartText: agreed.plannedStartText,
    plannedStartExact: agreed.plannedStartExact,
    hasCustomerMessages: ordered.some(isCustomerMessage),
  };
}

export function buildCalendarActionHref(
  proposalId: string,
  summary: Pick<
    ConversationResolutionSummary,
    "plannedStartText" | "plannedStartExact"
  >
): string {
  const params = new URLSearchParams();
  params.set("confirmBooking", "1");
  if (summary.plannedStartText) {
    params.set("plannedStartHint", summary.plannedStartText);
  }
  if (summary.plannedStartExact) {
    params.set("plannedStartExact", summary.plannedStartExact);
  }
  return `/proposals/${proposalId}?${params.toString()}`;
}
