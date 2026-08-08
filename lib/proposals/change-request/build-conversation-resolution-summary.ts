import { classifyChangeRequestLabels } from "@/lib/proposals/change-request/analyze-change-request";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  findLatestConfirmedDateAgreement,
  formatAgreementDateLabel,
  isVagueDateWindowOnly,
} from "@/lib/proposals/revision/conversation-agreements";
import { buildScheduleWorkspacePath } from "@/lib/proposals/schedule/schedule-fields";
import {
  formatPlannedStartExact,
  normalizePlannedStartExact,
} from "@/lib/proposals/planned-start-date";

export type ResolutionRecommendedAction =
  | "update_proposal"
  | "open_calendar"
  | "reply";

/** Optional live proposal fields used as context alongside the conversation. */
export type ResolutionProposalContext = {
  plannedStartDateText?: string | null;
  plannedStartDate?: string | null;
  jobSummary?: string | null;
};

export type ConversationResolutionSummary = {
  /** What started the discussion. */
  customerRequest: string;
  /** What was agreed after the back-and-forth. */
  conversationOutcome: string;
  /** Which workflow the trader should use next. */
  nextActionLabel: string;
  recommendedAction: ResolutionRecommendedAction;
  /** Prefill for Open calendar — never auto-saved. */
  plannedStartText: string | null;
  plannedStartExact: string | null;
  hasCustomerMessages: boolean;
};

function isCustomerMessage(message: ProposalCustomerMessage): boolean {
  return message.direction !== "trader" && message.kind !== "trader_reply";
}

function isTraderMessage(message: ProposalCustomerMessage): boolean {
  return message.direction === "trader" || message.kind === "trader_reply";
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

function openingCustomerMessage(
  messages: ProposalCustomerMessage[]
): ProposalCustomerMessage | null {
  const customer = messages.filter(isCustomerMessage);
  if (customer.length === 0) {
    return null;
  }

  const changeRequests = customer.filter(
    (message) => message.kind === "change_request"
  );
  return changeRequests.length > 0 ? changeRequests[0] : customer[0];
}

function buildCustomerRequest(messages: ProposalCustomerMessage[]): string {
  const source = openingCustomerMessage(messages);
  if (!source) {
    return "No customer request yet.";
  }

  const labels = classifyChangeRequestLabels(source.body);
  const snippet = quoteSnippet(source.body);

  if (isVagueDateWindowOnly(source.body) || labels.includes("date")) {
    if (labels.includes("materials") || labels.includes("scope")) {
      return `Customer asked to change timing and the work: “${snippet}”`;
    }
    return `Customer asked to move the job timing: “${snippet}”`;
  }

  if (labels.includes("materials") && labels.includes("scope")) {
    return `Customer asked to change the scope and materials: “${snippet}”`;
  }
  if (labels.includes("materials")) {
    return `Customer asked about materials: “${snippet}”`;
  }
  if (labels.includes("scope")) {
    return `Customer asked to change the scope: “${snippet}”`;
  }
  if (labels.includes("price")) {
    return `Customer asked about price: “${snippet}”`;
  }

  return `Customer wrote: “${snippet}”`;
}

function currentProposalScheduleLabel(
  context?: ResolutionProposalContext | null
): string | null {
  if (!context) {
    return null;
  }
  const exact = normalizePlannedStartExact(context.plannedStartDate);
  if (exact) {
    return formatPlannedStartExact(exact);
  }
  const text = context.plannedStartDateText?.trim();
  return text || null;
}

function buildConversationOutcome(
  messages: ProposalCustomerMessage[],
  now: Date,
  context?: ResolutionProposalContext | null
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
      text: `Trader offered ${label} and customer confirmed this works.`,
      plannedStartText: label,
      plannedStartExact: agreement.dateIso,
      hasDateAgreement: true,
    };
  }

  // Look for other confirmed exchanges (materials/scope) after trader reply.
  const ordered = messages;
  for (let i = ordered.length - 1; i >= 1; i -= 1) {
    const customerMessage = ordered[i];
    if (!isCustomerMessage(customerMessage)) {
      continue;
    }
    const traderMessage = [...ordered.slice(0, i)]
      .reverse()
      .find((message) => isTraderMessage(message));
    if (!traderMessage) {
      continue;
    }

    const labels = classifyChangeRequestLabels(
      `${traderMessage.body}\n${customerMessage.body}`
    );
    const customerConfirms =
      /\b(yes|yeah|yep|ok(ay)?|perfect|agreed|sounds good|that works|go ahead|confirmed|fine)\b/i.test(
        customerMessage.body
      );
    if (!customerConfirms) {
      continue;
    }

    if (labels.includes("materials")) {
      return {
        text: `Trader and customer confirmed a materials change: “${quoteSnippet(customerMessage.body, 120)}”`,
        plannedStartText: null,
        plannedStartExact: null,
        hasDateAgreement: false,
      };
    }
    if (labels.includes("scope")) {
      return {
        text: `Trader and customer confirmed a scope change: “${quoteSnippet(customerMessage.body, 120)}”`,
        plannedStartText: null,
        plannedStartExact: null,
        hasDateAgreement: false,
      };
    }
  }

  const customer = messages.filter(isCustomerMessage);
  const latest = customer[customer.length - 1];
  const scheduleLabel = currentProposalScheduleLabel(context);

  if (latest?.kind === "question" && /\?/.test(latest.body)) {
    return {
      text: scheduleLabel
        ? `Nothing firm agreed in the conversation yet — they may still be waiting on an answer. Current proposal start: ${scheduleLabel}.`
        : "Nothing firm agreed in the conversation yet — they may still be waiting on an answer.",
      plannedStartText: null,
      plannedStartExact: null,
      hasDateAgreement: false,
    };
  }

  const hasTraderReply = messages.some(isTraderMessage);
  if (hasTraderReply) {
    return {
      text: scheduleLabel
        ? `No confirmed decision yet after the back-and-forth. Current proposal start: ${scheduleLabel}.`
        : "No confirmed decision yet after the back-and-forth.",
      plannedStartText: null,
      plannedStartExact: null,
      hasDateAgreement: false,
    };
  }

  return {
    text: scheduleLabel
      ? `No firm agreement recorded yet in this conversation. Current proposal start: ${scheduleLabel}.`
      : "No firm agreement recorded yet in this conversation.",
    plannedStartText: null,
    plannedStartExact: null,
    hasDateAgreement: false,
  };
}

function recommendAction(input: {
  hasDateAgreement: boolean;
  messages: ProposalCustomerMessage[];
  hasNonDateAgreement: boolean;
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
    input.hasNonDateAgreement ||
    labels.includes("scope") ||
    labels.includes("materials") ||
    labels.includes("price")
  ) {
    return "update_proposal";
  }

  return "reply";
}

export function formatResolutionNextActionLabel(
  action: ResolutionRecommendedAction
): string {
  switch (action) {
    case "open_calendar":
      return "Update calendar schedule.";
    case "update_proposal":
      return "Update the proposal.";
    case "reply":
      return "Reply to the customer.";
  }
}

/**
 * Plain-language summary for the change-request resolution UI.
 * Uses the full conversation thread and prefers latest confirmed decisions.
 * No AI labels in the returned copy.
 */
export function buildConversationResolutionSummary(
  messages: ProposalCustomerMessage[],
  now: Date = new Date(),
  proposalContext?: ResolutionProposalContext | null
): ConversationResolutionSummary {
  const ordered = orderedMessages(messages);
  const customerRequest = buildCustomerRequest(ordered);
  const outcome = buildConversationOutcome(ordered, now, proposalContext);
  const hasNonDateAgreement =
    !outcome.hasDateAgreement &&
    /confirmed a (materials|scope) change/i.test(outcome.text);
  const recommendedAction = recommendAction({
    hasDateAgreement: outcome.hasDateAgreement,
    messages: ordered,
    hasNonDateAgreement,
  });

  return {
    customerRequest,
    conversationOutcome: outcome.text,
    nextActionLabel: formatResolutionNextActionLabel(recommendedAction),
    recommendedAction,
    plannedStartText: outcome.plannedStartText,
    plannedStartExact: outcome.plannedStartExact,
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
  return buildScheduleWorkspacePath(proposalId, {
    suggestedDateText: summary.plannedStartText,
    suggestedDateExact: summary.plannedStartExact,
  });
}
