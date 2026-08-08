import { classifyChangeRequestLabels } from "@/lib/proposals/change-request/analyze-change-request";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  findLatestConfirmedDateAgreement,
  formatAgreementDateLabel,
  isVagueDateWindowOnly,
} from "@/lib/proposals/revision/conversation-agreements";
import { buildScheduleWorkspacePath } from "@/lib/proposals/schedule/schedule-fields";

/** Soft calendar prefill / request wording only — never shown as conversation outcome. */
export type ConversationResolutionSummary = {
  /** Plain-language description of what the customer requested. */
  customerRequest: string;
  /** Original customer wording for reference. */
  originalRequestWording: string;
  /**
   * Soft calendar prefill only — never shown as a conversation outcome.
   * Nothing is booked until the trader confirms in the calendar workspace.
   */
  plannedStartText: string | null;
  plannedStartExact: string | null;
  hasCustomerMessages: boolean;
};

function isCustomerMessage(message: ProposalCustomerMessage): boolean {
  return message.direction !== "trader" && message.kind !== "trader_reply";
}

function quoteSnippet(body: string, max = 280): string {
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

function buildCustomerRequestSummary(
  source: ProposalCustomerMessage | null
): string {
  if (!source) {
    return "No customer request yet.";
  }

  const labels = classifyChangeRequestLabels(source.body);

  if (isVagueDateWindowOnly(source.body) || labels.includes("date")) {
    if (labels.includes("materials") || labels.includes("scope")) {
      return "Customer asked to change timing and the work.";
    }
    return "Customer asked to move the job timing.";
  }

  if (labels.includes("materials") && labels.includes("scope")) {
    return "Customer asked to change the scope and materials.";
  }
  if (labels.includes("materials")) {
    return "Customer asked about materials.";
  }
  if (labels.includes("scope")) {
    return "Customer asked to change the scope.";
  }
  if (labels.includes("price")) {
    return "Customer asked about price.";
  }

  return "Customer sent a request about this proposal.";
}

/**
 * Builds request context for the resolution UI.
 * Soft date prefill may use the thread silently — never exposes "outcome" copy.
 */
export function buildConversationResolutionSummary(
  messages: ProposalCustomerMessage[],
  now: Date = new Date()
): ConversationResolutionSummary {
  const ordered = orderedMessages(messages);
  const source = openingCustomerMessage(ordered);
  const agreement = findLatestConfirmedDateAgreement(ordered, now);
  const plannedStartText = agreement
    ? formatAgreementDateLabel(agreement)
    : null;

  return {
    customerRequest: buildCustomerRequestSummary(source),
    originalRequestWording: source
      ? quoteSnippet(source.body)
      : "No original request wording yet.",
    plannedStartText,
    plannedStartExact: agreement?.dateIso ?? null,
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
