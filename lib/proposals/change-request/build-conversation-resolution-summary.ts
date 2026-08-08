import { classifyChangeRequestLabels } from "@/lib/proposals/change-request/analyze-change-request";
import type { ChangeRequestLabel } from "@/lib/proposals/change-request/analyze-change-request";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  findLatestConfirmedDateAgreement,
  formatAgreementDateLabel,
  isVagueDateWindowOnly,
} from "@/lib/proposals/revision/conversation-agreements";
import { buildScheduleWorkspacePath } from "@/lib/proposals/schedule/schedule-fields";

/** Primary mobile next-step mode for the trader attention screen. */
export type ConversationResolutionFocus = "date" | "update";

/** Soft calendar prefill / aggregated request wording for the resolution UI. */
export type ConversationResolutionSummary = {
  /** Short headline for the customer request block. */
  customerRequest: string;
  /** Distinct unresolved requests from the full conversation. */
  customerRequestItems: string[];
  /** Original customer wording (all relevant messages). */
  originalRequestWording: string;
  /** Business impacts implied by the requests. */
  possibleImpacts: string[];
  /**
   * Soft calendar prefill only — never shown as a conversation outcome.
   * Nothing is booked as confirmed until the customer accepts.
   */
  plannedStartText: string | null;
  plannedStartExact: string | null;
  hasCustomerMessages: boolean;
  /**
   * Mobile trader card: plain-language “what happened”.
   * Desktop keeps the richer summary fields above.
   */
  mobileHeadline: string;
  /** One-line supporting detail under the mobile headline. */
  mobileDescription: string;
  /** Which primary resolution UI to show on mobile. */
  resolutionFocus: ConversationResolutionFocus;
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

function isShortConfirmationOnly(body: string): boolean {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length > 80) {
    return false;
  }
  return /^(yes|yeah|yep|yup|ok|okay|perfect|agreed|sounds good|that works|that date is fine|that's fine|thats fine)([.!]?)$/i.test(
    cleaned
  );
}

function customerRequestMessages(
  messages: ProposalCustomerMessage[]
): ProposalCustomerMessage[] {
  return messages.filter((message) => {
    if (!isCustomerMessage(message)) {
      return false;
    }
    if (message.kind === "accept_note") {
      return false;
    }
    if (isShortConfirmationOnly(message.body)) {
      return false;
    }
    return message.kind === "change_request" || message.kind === "question";
  });
}

/**
 * Turns a customer message into a short request bullet for the trader UI.
 */
export function requestItemTitleFromMessage(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim().replace(/[.?!]+$/g, "");
  const lower = cleaned.toLowerCase();

  if (/\bdoor\b/.test(lower) && /\bchang/.test(lower)) {
    return "Door change";
  }
  if (/\bdouble shower\b/.test(lower) || (/\bshower\b/.test(lower) && /\badd/.test(lower))) {
    return /\bdouble\b/.test(lower) ? "Add double shower" : "Add shower";
  }
  if (isVagueDateWindowOnly(cleaned) || classifyChangeRequestLabels(cleaned).includes("date")) {
    if (/\bwithin a month\b/i.test(cleaned)) {
      return "Move job timing";
    }
    return "Timing / date change";
  }
  if (/\bmaterial|tile|oak|finish|colour|color\b/i.test(cleaned)) {
    return quoteSnippet(cleaned, 72);
  }
  if (/\bprice|cost|budget|cheaper|expensive\b/i.test(cleaned)) {
    return "Price review";
  }

  // Strip soft lead-ins like "May need" / "Also wants"
  const stripped = cleaned
    .replace(/^(also\s+)?(may need|might need|need to|needs?|wants?|want to|please|can we|could we)\s+/i, "")
    .replace(/^(the\s+)?/i, "");

  if (!stripped) {
    return quoteSnippet(cleaned, 72);
  }

  const titled =
    stripped.charAt(0).toUpperCase() + stripped.slice(1);
  return quoteSnippet(titled, 72);
}

function impactLabelsFromLabels(labels: ChangeRequestLabel[]): string[] {
  const impacts: string[] = [];
  if (labels.includes("scope")) {
    impacts.push("Scope change");
  }
  if (labels.includes("materials")) {
    impacts.push("Materials change");
  }
  if (labels.includes("price")) {
    impacts.push("Price review");
  }
  if (labels.includes("date")) {
    impacts.push("Duration / timing review");
  }
  // Duration can also come from scope-heavy phrasing without an explicit date.
  if (
    labels.includes("scope") &&
    !impacts.includes("Duration / timing review")
  ) {
    impacts.push("Duration review");
  }
  return impacts;
}

/**
 * Picks the mobile primary action mode.
 * Work/scope/material/price wins over date when both appear.
 */
export function resolveConversationFocus(
  labels: ChangeRequestLabel[]
): ConversationResolutionFocus {
  const hasWork =
    labels.includes("scope") ||
    labels.includes("materials") ||
    labels.includes("price");
  if (hasWork) {
    return "update";
  }
  if (labels.includes("date")) {
    return "date";
  }
  return "update";
}

export function buildMobileRequestCopy(input: {
  items: string[];
  sources: ProposalCustomerMessage[];
  labels: ChangeRequestLabel[];
  focus: ConversationResolutionFocus;
}): { mobileHeadline: string; mobileDescription: string } {
  const { items, sources, labels, focus } = input;
  const latestBody = sources[sources.length - 1]?.body ?? "";
  const description =
    items[0] ??
    (latestBody ? quoteSnippet(latestBody, 96) : "See the conversation for details.");

  if (focus === "date") {
    return {
      mobileHeadline: "Customer requested a date change",
      mobileDescription: description,
    };
  }

  const wantsExtraWork = sources.some((message) =>
    /\b(add|added|extra|also|additional)\b/i.test(message.body)
  );
  if (labels.includes("materials") && !labels.includes("scope")) {
    return {
      mobileHeadline: "Customer requested a materials change",
      mobileDescription: description,
    };
  }
  if (wantsExtraWork || labels.includes("scope")) {
    return {
      mobileHeadline: "Customer requested additional work",
      mobileDescription: description,
    };
  }
  if (labels.includes("price")) {
    return {
      mobileHeadline: "Customer requested a price change",
      mobileDescription: description,
    };
  }

  return {
    mobileHeadline: "Customer sent a request",
    mobileDescription: description,
  };
}

function buildAggregatedRequests(messages: ProposalCustomerMessage[]): {
  items: string[];
  wording: string;
  impacts: string[];
  headline: string;
  labels: ChangeRequestLabel[];
  sources: ProposalCustomerMessage[];
  focus: ConversationResolutionFocus;
  mobileHeadline: string;
  mobileDescription: string;
} {
  const sources = customerRequestMessages(messages);
  if (sources.length === 0) {
    return {
      items: [],
      wording: "No original request wording yet.",
      impacts: [],
      headline: "No customer request yet.",
      labels: [],
      sources: [],
      focus: "update",
      mobileHeadline: "Customer sent a request",
      mobileDescription: "See the conversation for details.",
    };
  }

  const items: string[] = [];
  const seen = new Set<string>();
  const allLabels = new Set<ChangeRequestLabel>();

  for (const message of sources) {
    const title = requestItemTitleFromMessage(message.body);
    const key = title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(title);
    }
    for (const label of classifyChangeRequestLabels(message.body)) {
      allLabels.add(label);
    }
  }

  const wording = sources
    .map((message) => `“${quoteSnippet(message.body, 200)}”`)
    .join("\n");

  const impacts = impactLabelsFromLabels([...allLabels]);
  // Prefer duration wording from the product example when scope is present.
  const normalisedImpacts = impacts.map((impact) =>
    impact === "Duration / timing review" && allLabels.has("scope")
      ? impact
      : impact
  );

  // Dedupe "Duration review" vs "Duration / timing review"
  const impactSeen = new Set<string>();
  const uniqueImpacts: string[] = [];
  for (const impact of normalisedImpacts) {
    if (impactSeen.has(impact)) {
      continue;
    }
    impactSeen.add(impact);
    uniqueImpacts.push(impact);
  }

  // If we only have scope/materials requests, ensure price review is suggested lightly
  // when "add" scope is present (extra work usually needs price check).
  if (
    allLabels.has("scope") &&
    !uniqueImpacts.includes("Price review") &&
    sources.some((message) => /\b(add|added|extra|also)\b/i.test(message.body))
  ) {
    uniqueImpacts.push("Price review");
  }

  const labels = [...allLabels];
  const focus = resolveConversationFocus(labels);
  const mobile = buildMobileRequestCopy({
    items,
    sources,
    labels,
    focus,
  });

  const headline =
    items.length > 1
      ? "Customer asked about several changes."
      : items.length === 1
        ? `Customer asked: ${items[0]}.`
        : "Customer sent a request about this proposal.";

  return {
    items,
    wording,
    impacts: uniqueImpacts,
    headline,
    labels,
    sources,
    focus,
    mobileHeadline: mobile.mobileHeadline,
    mobileDescription: mobile.mobileDescription,
  };
}

/**
 * Builds request context for the resolution UI from the full conversation thread.
 * Soft date prefill may use the thread silently — never exposes "outcome" copy.
 */
export function buildConversationResolutionSummary(
  messages: ProposalCustomerMessage[],
  now: Date = new Date()
): ConversationResolutionSummary {
  const ordered = orderedMessages(messages);
  const aggregated = buildAggregatedRequests(ordered);
  const agreement = findLatestConfirmedDateAgreement(ordered, now);
  const plannedStartText = agreement
    ? formatAgreementDateLabel(agreement)
    : null;

  return {
    customerRequest: aggregated.headline,
    customerRequestItems: aggregated.items,
    originalRequestWording: aggregated.wording,
    possibleImpacts: aggregated.impacts,
    plannedStartText,
    plannedStartExact: agreement?.dateIso ?? null,
    hasCustomerMessages: ordered.some(isCustomerMessage),
    mobileHeadline: aggregated.mobileHeadline,
    mobileDescription: aggregated.mobileDescription,
    resolutionFocus: aggregated.focus,
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
