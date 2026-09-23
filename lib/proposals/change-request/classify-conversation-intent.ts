import { isVagueDateWindowOnly } from "@/lib/proposals/revision/conversation-agreements";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

/**
 * Conservative conversation vs structured-change classification.
 * Conversation is the default. Update proposal / date workflows only
 * appear when the customer is clearly asking to change the deal.
 */
export type ConversationIntent =
  | "conversation"
  | "proposal_change"
  | "date_change";

const WEEKDAY =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday";

const ARRIVAL_OR_DELAY =
  /\b(running late|run(?:ning)? a (?:little |bit )?late|a little late|bit late|stuck in traffic|on my way|be there (?:soon|in)|just leaving|\btraffic\b)\b/i;

const ACKNOWLEDGEMENT_ONLY =
  /^(yes|yeah|yep|yup|ok|okay|no problem|no worries|thanks|thank you|perfect|great|see you(?: soon)?|sounds good|that works|that(?:'s| is) fine)(?:[.!]*)?$/i;

const DATE_RESCHEDULE = new RegExp(
  [
    "\\b(?:",
    "reschedule|re-schedule|postpone|",
    "move .{0,40}(?:job|visit|booking|appointment|date)|",
    "move (?:it|this) (?:to|until)|",
    "change (?:the )?(?:date|day|time)|",
    "different (?:date|day|time)|",
    "another (?:date|day|time)|",
    `can we (?:do|come|start|book) .{0,60}(?:instead|${WEEKDAY}|next week|next month)|`,
    `could we (?:do|come|start|book|move) .{0,80}(?:instead|am\\b|pm\\b|${WEEKDAY}|next week|next month|\\d{1,2}(?::\\d{2})?|\\d{1,2}(?:st|nd|rd|th)?)|`,
    `instead of .{0,40}(?:${WEEKDAY}|next week|next month)|`,
    "i'?d like (?:a |this )?(?:different|another) (?:date|time)|",
    "requested date:",
    "requested time:",
    ")",
  ].join(""),
  "i"
);

const PROPOSAL_CHANGE = new RegExp(
  [
    "\\b(?:",
    "extra work|additional work|",
    "add(?:ed)? (?:a |an |the |another |two |three |four |\\d+ )|",
    "remove (?:the |this )|",
    "don'?t include|do not include|",
    "change (?:the )?(?:work|scope|job|door|shower|tiles?|materials?)|",
    "also (?:need|want)s?|",
    "may need .{0,40}chang",
    ")",
  ].join(""),
  "i"
);

const PRICE_CHANGE =
  /\b(price|pricing|cost|cheaper|expensive|budget|discount|too much|reduce (?:the )?(?:price|cost))\b/i;

const MATERIALS_CHANGE =
  /\b(material|materials|tile|tiles|colour|color|finish|brand|specification|spec)\b/i;

const MATERIALS_VERB = /\b(change|instead|upgrade|different|swap|use)\b/i;

const JOB_TIMING_CONTEXT =
  /\b(work|job|start|booking|visit|appointment|completed|finish)\b/i;

function isCustomerMessage(message: ProposalCustomerMessage): boolean {
  return message.direction !== "trader" && message.kind !== "trader_reply";
}

export function classifyConversationIntent(message: string): ConversationIntent {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) {
    return "conversation";
  }

  if (ACKNOWLEDGEMENT_ONLY.test(text)) {
    return "conversation";
  }

  const isProposalChange =
    PROPOSAL_CHANGE.test(text) ||
    PRICE_CHANGE.test(text) ||
    (MATERIALS_CHANGE.test(text) && MATERIALS_VERB.test(text));

  if (isProposalChange) {
    return "proposal_change";
  }

  const isDateChange =
    DATE_RESCHEDULE.test(text) ||
    (isVagueDateWindowOnly(text) && JOB_TIMING_CONTEXT.test(text));

  if (isDateChange && !ARRIVAL_OR_DELAY.test(text)) {
    return "date_change";
  }

  if (isDateChange && DATE_RESCHEDULE.test(text)) {
    return "date_change";
  }

  return "conversation";
}

export function isOrdinaryConversation(message: string): boolean {
  return classifyConversationIntent(message) === "conversation";
}

export function conversationRequiresTraderAction(message: string): boolean {
  return classifyConversationIntent(message) !== "conversation";
}

export function conversationHasProposalChange(
  messages: ProposalCustomerMessage[]
): boolean {
  return messages.some(
    (message) =>
      isCustomerMessage(message) &&
      classifyConversationIntent(message.body) === "proposal_change"
  );
}

export function conversationHasDateChange(
  messages: ProposalCustomerMessage[]
): boolean {
  return messages.some(
    (message) =>
      isCustomerMessage(message) &&
      classifyConversationIntent(message.body) === "date_change"
  );
}

export function isStructuredCustomerRequest(
  message: ProposalCustomerMessage
): boolean {
  if (!isCustomerMessage(message)) {
    return false;
  }
  if (message.kind === "accept_note") {
    return false;
  }
  return conversationRequiresTraderAction(message.body);
}
