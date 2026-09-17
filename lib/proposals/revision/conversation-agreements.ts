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

const CONFIRMATION_PATTERN =
  /\b(yes|yeah|yep|yup|that (date|day|works)|that date is fine|that('s| is) fine|that works( for me)?|works for me|perfect|agreed|sounds good|ok(ay)?|please book|go ahead|confirmed|happy with that|fine by me|fine with that|i can do( that)?|that('s| is) ok)\b/i;

const SHORT_AFFIRMATIVE_PATTERN =
  /\b(yes|yeah|yep|ok(ay)?|fine|perfect|agreed|works)\b/i;

/** Spoken/written times such as 10:30, 10.30am, or 9am. */
const SPECIFIC_TIME_PATTERN =
  /\b(?:at\s+)?((?:[01]?\d|2[0-3])[:.][0-5]\d)\s*(am|pm)?\b|\b((?:[01]?\d|2[0-3])\s*(am|pm))\b/i;

export type ConversationDateAgreement = {
  dateText: string;
  dateIso: string | null;
  /** 24-hour HH:MM when a specific time was agreed. Never invented. */
  timeHm: string | null;
  traderMessage: ProposalCustomerMessage;
  customerMessage: ProposalCustomerMessage;
  evidenceQuote: string;
};

function isTraderMessage(message: ProposalCustomerMessage): boolean {
  return message.direction === "trader" || message.kind === "trader_reply";
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

function hourFromMeridiem(hour: number, meridiem?: string): number | null {
  if (!meridiem) {
    if (hour > 23) {
      return null;
    }
    return hour;
  }

  const suffix = meridiem.toLowerCase();
  if (hour < 1 || hour > 12) {
    return null;
  }
  if (suffix === "am") {
    return hour === 12 ? 0 : hour;
  }
  return hour === 12 ? 12 : hour + 12;
}

/**
 * Turns a spoken time into HH:MM. Returns null when no exact time is present.
 */
export function extractSpecificTimeToHm(text: string): string | null {
  const match = text.match(SPECIFIC_TIME_PATTERN);
  if (!match) {
    return null;
  }

  if (match[1]) {
    const [hourRaw, minuteRaw] = match[1].split(/[:.]/);
    const hour = hourFromMeridiem(Number(hourRaw), match[2]);
    const minute = Number(minuteRaw);
    if (hour === null || Number.isNaN(minute) || minute > 59) {
      return null;
    }
    return `${pad2(hour)}:${pad2(minute)}`;
  }

  if (match[3]) {
    const clock = match[3].replace(/\s+/g, "");
    const hourRaw = Number(clock.replace(/am|pm/i, ""));
    const meridiem = clock.match(/am|pm/i)?.[0];
    const hour = hourFromMeridiem(hourRaw, meridiem);
    if (hour === null) {
      return null;
    }
    return `${pad2(hour)}:00`;
  }

  return null;
}

export function isVagueDateWindowOnly(text: string): boolean {
  const hasSpecific = Boolean(extractSpecificDateText(text));
  return !hasSpecific && VAGUE_DATE_WINDOW_PATTERN.test(text);
}

export function isCustomerConfirmation(text: string): boolean {
  return CONFIRMATION_PATTERN.test(text);
}

function isShortAffirmative(text: string): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length <= 80 && SHORT_AFFIRMATIVE_PATTERN.test(cleaned);
}

function datesMatch(left: string, right: string): boolean {
  return left.replace(/\s+/g, " ").trim().toLowerCase() ===
    right.replace(/\s+/g, " ").trim().toLowerCase();
}

function messageConfirmsOffer(
  replyBody: string,
  offerDateText: string,
  offerTimeHm: string | null
): boolean {
  const replyDate = extractSpecificDateText(replyBody);
  const replyTime = extractSpecificTimeToHm(replyBody);
  const sameDate = replyDate !== null && datesMatch(replyDate, offerDateText);
  const conflictingTime =
    Boolean(offerTimeHm && replyTime && replyTime !== offerTimeHm);
  const confirms = isCustomerConfirmation(replyBody) || isShortAffirmative(replyBody);

  if (replyDate && !sameDate) {
    return false;
  }
  if (conflictingTime) {
    return false;
  }
  if (sameDate) {
    return true;
  }
  return confirms && !replyDate;
}

function quoteForEvidence(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 140) {
    return cleaned;
  }
  return `${cleaned.slice(0, 137).trimEnd()}…`;
}

function laterCreatedAt(
  left: ProposalCustomerMessage,
  right: ProposalCustomerMessage
): string {
  return new Date(left.created_at) >= new Date(right.created_at)
    ? left.created_at
    : right.created_at;
}

function agreementHasLaterDifferentDate(
  ordered: ProposalCustomerMessage[],
  agreement: ConversationDateAgreement
): boolean {
  const cutoff = new Date(
    laterCreatedAt(agreement.traderMessage, agreement.customerMessage)
  );

  return ordered.some((message) => {
    if (new Date(message.created_at) <= cutoff) {
      return false;
    }
    const laterDate = extractSpecificDateText(message.body);
    if (laterDate && !datesMatch(laterDate, agreement.dateText)) {
      return true;
    }
    return isVagueDateWindowOnly(message.body);
  });
}

/**
 * Finds the latest specific date that both sides of the conversation confirmed.
 * Either person can offer the date. A later unconfirmed different date cancels it.
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
    const offerMessage = ordered[i];
    const dateText = extractSpecificDateText(offerMessage.body);
    if (!dateText) {
      continue;
    }

    const offerTimeHm = extractSpecificTimeToHm(offerMessage.body);
    const offerIsTrader = isTraderMessage(offerMessage);

    for (let j = i + 1; j < ordered.length; j += 1) {
      const replyMessage = ordered[j];
      if (isTraderMessage(replyMessage) === offerIsTrader) {
        continue;
      }

      if (!messageConfirmsOffer(replyMessage.body, dateText, offerTimeHm)) {
        continue;
      }

      const replyTimeHm = extractSpecificTimeToHm(replyMessage.body);
      const timeHm = offerTimeHm ?? replyTimeHm;
      const parseAt = new Date(replyMessage.created_at);
      const dateIso = parseFlexibleDateToIso(
        dateText,
        Number.isNaN(parseAt.getTime()) ? now : parseAt
      );
      const traderMessage = offerIsTrader ? offerMessage : replyMessage;
      const customerMessage = offerIsTrader ? replyMessage : offerMessage;

      latest = {
        dateText,
        dateIso,
        timeHm,
        traderMessage,
        customerMessage,
        evidenceQuote: [
          `Trader: “${quoteForEvidence(traderMessage.body)}”`,
          `Customer: “${quoteForEvidence(customerMessage.body)}”`,
        ].join(" "),
      };
    }
  }

  if (latest && agreementHasLaterDifferentDate(ordered, latest)) {
    return null;
  }

  return latest;
}

export function formatAgreementDateLabel(agreement: ConversationDateAgreement): string {
  if (agreement.dateIso) {
    return formatPlannedStartExact(agreement.dateIso);
  }
  return agreement.dateText;
}

function formatIsoDayMonth(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
}

/**
 * Mobile attention label: "12 August · 10:30". Never invents a time.
 */
export function formatAgreedSlotLabel(agreement: ConversationDateAgreement): string {
  const datePart = agreement.dateIso
    ? formatIsoDayMonth(agreement.dateIso)
    : agreement.dateText;
  if (agreement.timeHm) {
    return `${datePart} · ${agreement.timeHm}`;
  }
  return datePart;
}
