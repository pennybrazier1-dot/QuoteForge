/**
 * Deterministic extraction from Site Notes when the AI omits fields.
 * Scans full text — never splits on thousands commas inside amounts like £3,000.
 */

import { DURATION_CANNOT_DETERMINE_MESSAGE } from "./prompts";

const UK_POSTCODE_PATTERN = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i;
const EMAIL_PATTERN = /@/;
const PHONE_PATTERN = /\b07\d{3}[\s-]?\d{6}\b/;
const PRICE_IN_TEXT_PATTERN = /£|\bpounds?\b|\bprice\b|\bcost\b|\btotal\b/i;
const TIME_UNIT_PATTERN =
  /\b(?:hours?|days?|weeks?|months?|half\s+days?|full\s+days?|morning|afternoon)\b/i;
const DURATION_QUALIFIER_PATTERN = /\b(?:approximately|approx\.?|around|about)\b/i;
const ADDRESS_WORD_PATTERN =
  /\b(?:street|road|avenue|lane|drive|close|court|way|place|gardens|manchester|london|postcode|address)\b/i;

const PRICE_CAPTURE_PATTERNS = [
  /\b(?:estimate(?:d)?\s+)?price\s+(?:is\s+|of\s+|about\s+|around\s+)?£\s*([\d,]+(?:\.\d{2})?)/i,
  /\b(?:quote|quoted|pricing)\s+(?:is\s+|at\s+|around\s+|about\s+)?£\s*([\d,]+(?:\.\d{2})?)/i,
  /\b(?:estimated|estimate)\s+at\s+£\s*([\d,]+(?:\.\d{2})?)/i,
  /\b(?:around|approximately|about)\s+£\s*([\d,]+(?:\.\d{2})?)/i,
  /£\s*([\d,]+(?:\.\d{2})?)\s+estimate(?:d)?\s+price/i,
  /£\s*([\d,]+(?:\.\d{2})?)/i,
  /\b([\d,]+(?:\.\d{2})?)\s+pounds?\b/i,
];

const OPTIONAL_EXTRA_PATTERNS = [
  /\boptional extras?\s+(?:could be|could include|include|are|might be)\s+(.+?)(?:[.!?]|$)/i,
  /\bextras?\s+(?:could be|could include|include)\s+(.+?)(?:[.!?]|$)/i,
  /\badditional work\s+(?:could be|would be|could include|includes?)\s+(.+?)(?:[.!?]|$)/i,
  /\bnot included(?:\s+in\s+(?:the\s+)?(?:main\s+)?quote)?\s+but\s+(?:could\s+)?(?:add|include)\s+(.+?)(?:[.!?]|$)/i,
  /\bcustomer may also want\s+(.+?)(?:[.!?]|$)/i,
];

const DURATION_INLINE_PATTERNS = [
  /\b(?:estimated\s+)?duration\s+(?:is\s+|around\s+|approximately\s+|about\s+)?(.+?)(?:[.!?\n]|$)/i,
  /\b(?:expected|approx(?:imate)?)\s+(?:to\s+)?take\s+(?:around\s+|approximately\s+|about\s+)?(.+?)(?:[.!?\n]|$)/i,
  /\b(?:around|approximately|about)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s+(?:hours?|days?|weeks?)\b/i,
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s+(?:hours?|days?|weeks?)\b/i,
];

export const CONFIRM_ESTIMATED_DURATION = "Confirm estimated duration";

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function protectThousandsCommas(text: string): string {
  return text.replace(/(\d),(\d{3})/g, "$1__THOUSAND__$2");
}

function restoreThousandsCommas(text: string): string {
  return text.replace(/__THOUSAND__/g, ",");
}

function splitProtectedSegments(text: string): string[] {
  return restoreThousandsCommas(protectThousandsCommas(text))
    .split(/(?<=[.!?])\s+|\n+|;|\s*,\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function digitsOnlyPrice(amount: string): string {
  const cleaned = amount.replace(/[£,\s]/g, "").trim();
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  return value % 1 === 0 ? String(Math.round(value)) : value.toFixed(2);
}

export function isValidExtractedPriceDigits(value: string): boolean {
  const cleaned = value.replace(/[£,\s]/g, "").trim();
  return /^\d+(\.\d{1,2})?$/.test(cleaned) && Number(cleaned) > 0;
}

export function looksLikeInvalidDuration(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.includes(DURATION_CANNOT_DETERMINE_MESSAGE)) {
    return false;
  }

  if (UK_POSTCODE_PATTERN.test(trimmed)) {
    return true;
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return true;
  }

  if (PHONE_PATTERN.test(trimmed)) {
    return true;
  }

  if (PRICE_IN_TEXT_PATTERN.test(trimmed)) {
    return true;
  }

  if (ADDRESS_WORD_PATTERN.test(trimmed) && !TIME_UNIT_PATTERN.test(trimmed)) {
    return true;
  }

  if (!TIME_UNIT_PATTERN.test(trimmed)) {
    return true;
  }

  return false;
}

function scoreDurationCandidate(text: string): number {
  let score = 0;

  if (TIME_UNIT_PATTERN.test(text)) {
    score += 10;
  }

  if (DURATION_QUALIFIER_PATTERN.test(text)) {
    score += 5;
  }

  if (/\bduration\b/i.test(text)) {
    score += 8;
  }

  if (looksLikeInvalidDuration(text)) {
    return -100;
  }

  return score;
}

function normalizeDurationPhrase(text: string): string {
  return text
    .replace(/^\s*(?:estimated\s+)?duration\s*:?\s*/i, "")
    .replace(/[.,;]+$/, "")
    .trim();
}

export function extractDurationFromSiteNotes(siteNotes: string): string {
  const text = siteNotes.trim();
  if (!text) {
    return "";
  }

  let best = "";
  let bestScore = 0;

  for (const pattern of DURATION_INLINE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const candidate = normalizeDurationPhrase(match[0]);
    const score = scoreDurationCandidate(candidate) + 6;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  for (const segment of splitProtectedSegments(text)) {
    const score = scoreDurationCandidate(segment);
    if (score > bestScore) {
      bestScore = score;
      best = normalizeDurationPhrase(segment);
    }
  }

  return best;
}

export function normalizeExtractedPriceDigits(value: string): string {
  return digitsOnlyPrice(value);
}

export function extractEstimatedPriceDigits(siteNotes: string): string {
  const text = siteNotes.trim();
  if (!text) {
    return "";
  }

  for (const pattern of PRICE_CAPTURE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const digits = digitsOnlyPrice(match[1]);
      if (digits) {
        return digits;
      }
    }
  }

  return "";
}

export function priceDigitsToPence(digits: string): number | null {
  const cleaned = digits.replace(/[£,\s]/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

export function splitOptionalExtraItems(text: string): string[] {
  return text
    .split(/\s*,\s*|\s+and\s+|\s*;\s*|\s+or\s+/i)
    .map((item) => item.trim().replace(/^[-•]\s*/, ""))
    .filter((item) => item.length > 2);
}

function titleCaseExtra(item: string): string {
  const trimmed = item.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function extractOptionalExtrasFromSiteNotes(
  siteNotes: string,
  existing: string[] = []
): string[] {
  const text = siteNotes.trim();
  const extras = [...existing];
  const seen = new Set(existing.map((item) => normalizeKey(item)));

  if (!text) {
    return extras;
  }

  for (const pattern of OPTIONAL_EXTRA_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    for (const item of splitOptionalExtraItems(match[1])) {
      const key = normalizeKey(item);
      if (!key || key.length < 4 || seen.has(key) || /^s could be/i.test(item)) {
        continue;
      }

      extras.push(titleCaseExtra(item));
      seen.add(key);
    }
  }

  return extras;
}

export function looksLikeOptionalExtraTrigger(text: string): boolean {
  return /\b(optional extras?|extras could|extras include|additional work|not included|customer may also want)\b/i.test(
    text
  );
}

export function expandOptionalExtraCandidates(items: string[]): string[] {
  const expanded: string[] = [];

  for (const item of items.map((entry) => entry.trim()).filter(Boolean)) {
    if (looksLikeOptionalExtraTrigger(item)) {
      expanded.push(...extractOptionalExtrasFromSiteNotes(item, []));
      continue;
    }

    const parts = splitOptionalExtraItems(item);
    expanded.push(...(parts.length > 1 ? parts : [item]));
  }

  return expanded;
}
