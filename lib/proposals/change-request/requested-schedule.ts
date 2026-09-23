import { analyzeBookingClashes } from "@/lib/calendar/clash-detection";
import type { CalendarJob } from "@/lib/calendar/calendar-data";
import { formatPlannedStartExact } from "@/lib/proposals/planned-start-date";
import {
  classifyConversationIntent,
} from "@/lib/proposals/change-request/classify-conversation-intent";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  extractSpecificDateText,
  extractSpecificTimeToHm,
  parseFlexibleDateToIso,
} from "@/lib/proposals/revision/conversation-agreements";

/** What the customer asked to change on the diary. */
export type RequestedScheduleKind = "time" | "date" | "date_time";

/** Where the exact slot was read from. Structured sources win. */
export type RequestedScheduleSource =
  | "structured_message"
  | "event_metadata"
  | "parsed_message";

export type RequestedScheduleSlot = {
  dateIso: string | null;
  timeHm: string | null;
  kind: RequestedScheduleKind | null;
  /** Prominent trader-facing value. Null when nothing exact was found. */
  displayValue: string | null;
  dateLabel: string | null;
  timeLabel: string | null;
  source: RequestedScheduleSource | null;
};

export type RequestedScheduleAvailability = "available" | "unavailable" | "unknown";

export type OutstandingRequestItem = {
  kind: "schedule" | "job";
  title: string;
  detail: string | null;
};

const STRUCTURED_DATE = /requested date:\s*(\d{4}-\d{2}-\d{2})/i;
const STRUCTURED_TIME = /requested time:\s*(\d{1,2}:\d{2})/i;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeTimeHm(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return `${pad2(hour)}:${pad2(minute)}`;
}

function readIsoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function isCustomerMessage(message: ProposalCustomerMessage): boolean {
  return message.direction !== "trader" && message.kind !== "trader_reply";
}

/** Turns 14:30 into 2:30pm. Never invents a time. */
export function formatRequestedTimeLabel(timeHm: string): string {
  const normalised = normalizeTimeHm(timeHm);
  if (!normalised) {
    return timeHm;
  }
  const [hourRaw, minuteRaw] = normalised.split(":").map(Number);
  const suffix = hourRaw >= 12 ? "pm" : "am";
  const hour12 = hourRaw % 12 === 0 ? 12 : hourRaw % 12;
  return `${hour12}:${pad2(minuteRaw)}${suffix}`;
}

/** Turns 2026-09-24 into 24 September 2026. */
export function formatRequestedDateLabel(dateIso: string): string {
  return formatPlannedStartExact(dateIso);
}

/** Shorter diary line: 24 September · 2:30pm */
export function formatRequestedAvailabilityLabel(input: {
  dateIso?: string | null;
  timeHm?: string | null;
}): string | null {
  const datePart = input.dateIso
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
      }).format(
        new Date(
          Number(input.dateIso.slice(0, 4)),
          Number(input.dateIso.slice(5, 7)) - 1,
          Number(input.dateIso.slice(8, 10))
        )
      )
    : null;
  const timePart = input.timeHm ? formatRequestedTimeLabel(input.timeHm) : null;
  if (datePart && timePart) {
    return `${datePart} · ${timePart}`;
  }
  return datePart || timePart;
}

export function requestedScheduleKind(input: {
  dateIso?: string | null;
  timeHm?: string | null;
}): RequestedScheduleKind | null {
  if (input.dateIso && input.timeHm) {
    return "date_time";
  }
  if (input.dateIso) {
    return "date";
  }
  if (input.timeHm) {
    return "time";
  }
  return null;
}

export function formatRequestedSlotDisplay(input: {
  dateIso?: string | null;
  timeHm?: string | null;
}): string | null {
  const kind = requestedScheduleKind(input);
  if (kind === "date_time" && input.dateIso && input.timeHm) {
    return `${formatRequestedDateLabel(input.dateIso)} · ${formatRequestedTimeLabel(input.timeHm)}`;
  }
  if (kind === "date" && input.dateIso) {
    return formatRequestedDateLabel(input.dateIso);
  }
  if (kind === "time" && input.timeHm) {
    return formatRequestedTimeLabel(input.timeHm);
  }
  return null;
}

export function headlineForRequestedSchedule(
  kind: RequestedScheduleKind | null
): string {
  if (kind === "time") {
    return "Customer requested a time change";
  }
  if (kind === "date_time") {
    return "Customer requested a date & time change";
  }
  return "Customer requested a date change";
}

export function acceptLabelForRequestedSchedule(
  kind: RequestedScheduleKind | null
): string {
  if (kind === "time") {
    return "Accept time";
  }
  if (kind === "date") {
    return "Accept date";
  }
  if (kind === "date_time") {
    return "Accept date & time";
  }
  return "Accept";
}

export function suggestLabelForRequestedSchedule(
  kind: RequestedScheduleKind | null
): string {
  if (kind === "time") {
    return "Suggest another time";
  }
  if (kind === "date") {
    return "Suggest another date";
  }
  return "Suggest another date/time";
}

export function promptForRequestedSchedule(
  kind: RequestedScheduleKind | null
): string {
  if (kind === "time") {
    return "Can you do this time?";
  }
  if (kind === "date") {
    return "Can you do this date?";
  }
  return "Can you do this?";
}

function emptySlot(): RequestedScheduleSlot {
  return {
    dateIso: null,
    timeHm: null,
    kind: null,
    displayValue: null,
    dateLabel: null,
    timeLabel: null,
    source: null,
  };
}

function toSlot(
  dateIso: string | null,
  timeHm: string | null,
  source: RequestedScheduleSource
): RequestedScheduleSlot {
  const kind = requestedScheduleKind({ dateIso, timeHm });
  if (!kind) {
    return emptySlot();
  }
  return {
    dateIso,
    timeHm,
    kind,
    displayValue: formatRequestedSlotDisplay({ dateIso, timeHm }),
    dateLabel: dateIso ? formatRequestedDateLabel(dateIso) : null,
    timeLabel: timeHm ? formatRequestedTimeLabel(timeHm) : null,
    source,
  };
}

export function extractStructuredRequestedSlot(
  body: string
): { dateIso: string | null; timeHm: string | null } {
  const dateMatch = body.match(STRUCTURED_DATE);
  const timeMatch = body.match(STRUCTURED_TIME);
  return {
    dateIso: dateMatch?.[1] ?? null,
    timeHm: normalizeTimeHm(timeMatch?.[1] ?? null),
  };
}

/** Parse a spoken request only when no structured value exists. Never invents. */
export function extractParsedRequestedSlot(
  body: string,
  now: Date = new Date()
): { dateIso: string | null; timeHm: string | null } {
  if (classifyConversationIntent(body) !== "date_change") {
    return { dateIso: null, timeHm: null };
  }
  const dateText = extractSpecificDateText(body);
  const dateIso = dateText ? parseFlexibleDateToIso(dateText, now) : null;
  const timeHm = extractSpecificTimeToHm(body);
  return { dateIso, timeHm };
}

function latestCustomerRequestMessages(
  messages: ProposalCustomerMessage[]
): ProposalCustomerMessage[] {
  return [...messages]
    .filter(
      (message) =>
        isCustomerMessage(message) &&
        message.kind !== "accept_note" &&
        message.body.trim().length > 0
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

function extractFromStructuredMessages(
  messages: ProposalCustomerMessage[]
): RequestedScheduleSlot | null {
  const latest = [...latestCustomerRequestMessages(messages)]
    .reverse()
    .find(
      (message) =>
        STRUCTURED_DATE.test(message.body) || STRUCTURED_TIME.test(message.body)
    );
  if (!latest) {
    return null;
  }
  const structured = extractStructuredRequestedSlot(latest.body);
  const slot = toSlot(structured.dateIso, structured.timeHm, "structured_message");
  return slot.kind ? slot : null;
}

function extractFromEventMetadata(
  events: Array<{ metadata?: Record<string, unknown> | null; created_at: string }>
): RequestedScheduleSlot | null {
  const latest = [...events]
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .reverse()
    .find((event) => {
      const dateIso = readIsoDate(event.metadata?.requested_date);
      const timeHm = normalizeTimeHm(
        typeof event.metadata?.requested_time === "string"
          ? event.metadata.requested_time
          : null
      );
      return Boolean(dateIso || timeHm);
    });
  if (!latest) {
    return null;
  }
  const dateIso = readIsoDate(latest.metadata?.requested_date);
  const timeHm = normalizeTimeHm(
    typeof latest.metadata?.requested_time === "string"
      ? latest.metadata.requested_time
      : null
  );
  const slot = toSlot(dateIso, timeHm, "event_metadata");
  return slot.kind ? slot : null;
}

function extractFromParsedMessages(
  messages: ProposalCustomerMessage[],
  now: Date
): RequestedScheduleSlot | null {
  const latest = [...latestCustomerRequestMessages(messages)]
    .reverse()
    .find(
      (message) => classifyConversationIntent(message.body) === "date_change"
    );
  if (!latest) {
    return null;
  }
  const parsedAt = new Date(latest.created_at);
  const parsed = extractParsedRequestedSlot(
    latest.body,
    Number.isNaN(parsedAt.getTime()) ? now : parsedAt
  );
  const slot = toSlot(parsed.dateIso, parsed.timeHm, "parsed_message");
  return slot.kind ? slot : null;
}

/**
 * Prefers structured message fields, then event metadata, then spoken text.
 * Never invents a date or time.
 */
export function extractRequestedSchedule(input: {
  messages: ProposalCustomerMessage[];
  events?: Array<{
    metadata?: Record<string, unknown> | null;
    created_at: string;
  }>;
  now?: Date;
}): RequestedScheduleSlot {
  const structured = extractFromStructuredMessages(input.messages);
  if (structured) {
    return structured;
  }
  const fromEvents = extractFromEventMetadata(input.events ?? []);
  if (fromEvents) {
    return fromEvents;
  }
  return (
    extractFromParsedMessages(input.messages, input.now ?? new Date()) ??
    emptySlot()
  );
}

/**
 * Uses the existing diary clash check. Returns only available / not available.
 * Never includes other customer or job names.
 */
export function requestedSlotAvailability(input: {
  dateIso: string | null;
  proposalId?: string | null;
  duration?: string | null;
  existingJobs?: CalendarJob[];
}): RequestedScheduleAvailability {
  if (!input.dateIso) {
    return "unknown";
  }
  if (!input.existingJobs) {
    return "unknown";
  }
  const analysis = analyzeBookingClashes(
    {
      proposalId: input.proposalId || "current-proposal",
      startDateIso: input.dateIso,
      duration: input.duration,
      bookingStatus: "confirmed",
    },
    input.existingJobs
  );
  return analysis.hasStrongOrWarning ? "unavailable" : "available";
}

export function scheduleFieldLabel(kind: RequestedScheduleKind | null): string {
  if (kind === "time") {
    return "Requested time";
  }
  if (kind === "date") {
    return "Requested date";
  }
  return "Requested time";
}
