import {
  formatPlannedStartExact,
  isIsoDateString,
} from "@/lib/proposals/planned-start-date";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/** Specific calendar-style dates, not vague windows like "within a month". */
export const SPECIFIC_DATE_PATTERN =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{2,4}))?\b|\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/i;

const VAGUE_DATE_WINDOW_PATTERN =
  /\b(within a month|within the month|in a month|asap|whenever|soon|this week|next week|next month|by the end of (the )?month)\b/i;

const CUSTOMER_CONFIRMATION_PATTERN =
  /\b(yes|yeah|yep|yup|that (date|day|works)|that date is fine|that('s| is) fine|that works( for me)?|perfect|agreed|sounds good|ok(ay)?|please book|go ahead|confirmed|happy with that|fine by me|fine with that)\b/i;

export type ConversationDateAgreement = {
  dateText: string;
  dateIso: string | null;
  traderMessage: ProposalCustomerMessage;
  customerMessage: ProposalCustomerMessage;
  evidenceQuote: string;
};

function isTraderMessage(message: ProposalCustomerMessage): boolean {
  return message.direction === "trader" || message.kind === "trader_reply";
}

function isCustomerMessage(message: ProposalCustomerMessage): boolean {
  return !isTraderMessage(message);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Converts flexible spoken/written dates like "12 October" into YYYY-MM-DD.
 * Assumes the next occurrence on or after `now` when year is omitted.
 */
export function parseFlexibleDateToIso(
  text: string,
  now: Date = new Date()
): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (isIsoDateString(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(SPECIFIC_DATE_PATTERN);
  if (!match) {
    return null;
  }

  if (match[1] && match[2]) {
    const day = Number(match[1]);
    const month = MONTHS[match[2].toLowerCase()];
    if (!month) {
      return null;
    }
    let year = match[3] ? Number(match[3]) : now.getFullYear();
    if (match[3] && year < 100) {
      year += 2000;
    }
    let iso = toIsoDate(year, month, day);
    if (!iso) {
      return null;
    }
    if (!match[3]) {
      const candidate = new Date(year, month - 1, day);
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      if (candidate < startOfToday) {
        iso = toIsoDate(year + 1, month, day);
      }
    }
    return iso;
  }

  if (match[4] && match[5]) {
    const day = Number(match[4]);
    const month = Number(match[5]);
    let year = match[6] ? Number(match[6]) : now.getFullYear();
    if (match[6] && year < 100) {
      year += 2000;
    }
    let iso = toIsoDate(year, month, day);
    if (!iso) {
      return null;
    }
    if (!match[6]) {
      const candidate = new Date(year, month - 1, day);
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      if (candidate < startOfToday) {
        iso = toIsoDate(year + 1, month, day);
      }
    }
    return iso;
  }

  return null;
}

export function extractSpecificDateText(text: string): string | null {
  const match = text.match(SPECIFIC_DATE_PATTERN);
  if (!match) {
    return null;
  }
  return match[0].replace(/\s+/g, " ").trim();
}

export function isVagueDateWindowOnly(text: string): boolean {
  const hasSpecific = Boolean(extractSpecificDateText(text));
  return !hasSpecific && VAGUE_DATE_WINDOW_PATTERN.test(text);
}

export function isCustomerConfirmation(text: string): boolean {
  return CUSTOMER_CONFIRMATION_PATTERN.test(text);
}

function quoteForEvidence(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 140) {
    return cleaned;
  }
  return `${cleaned.slice(0, 137).trimEnd()}…`;
}

/**
 * Finds the latest trader date proposal that a later customer message confirms.
 */
export function findLatestConfirmedDateAgreement(
  messages: ProposalCustomerMessage[],
  now: Date = new Date()
): ConversationDateAgreement | null {
  const ordered = [...messages]
    .filter((message) => message.body.trim().length > 0)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  let latest: ConversationDateAgreement | null = null;

  for (let i = 0; i < ordered.length; i += 1) {
    const traderMessage = ordered[i];
    if (!isTraderMessage(traderMessage)) {
      continue;
    }

    const dateText = extractSpecificDateText(traderMessage.body);
    if (!dateText) {
      continue;
    }

    for (let j = i + 1; j < ordered.length; j += 1) {
      const customerMessage = ordered[j];
      if (!isCustomerMessage(customerMessage)) {
        continue;
      }

      const customerDate = extractSpecificDateText(customerMessage.body);
      const confirms =
        isCustomerConfirmation(customerMessage.body) ||
        (customerDate !== null &&
          customerDate.toLowerCase() === dateText.toLowerCase()) ||
        // Short affirmative replies after a dated trader offer.
        (customerMessage.body.trim().length <= 80 &&
          /\b(yes|yeah|yep|ok(ay)?|fine|perfect|agreed)\b/i.test(
            customerMessage.body
          ));

      if (!confirms) {
        continue;
      }

      const dateIso = parseFlexibleDateToIso(dateText, now);
      latest = {
        dateText,
        dateIso,
        traderMessage,
        customerMessage,
        evidenceQuote: [
          `Trader: “${quoteForEvidence(traderMessage.body)}”`,
          `Customer: “${quoteForEvidence(customerMessage.body)}”`,
        ].join(" "),
      };
    }
  }

  return latest;
}

export function formatAgreementDateLabel(agreement: ConversationDateAgreement): string {
  if (agreement.dateIso) {
    return formatPlannedStartExact(agreement.dateIso);
  }
  return agreement.dateText;
}
