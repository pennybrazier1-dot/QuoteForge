import { resolveLondonLocalDateTime } from "@/lib/visits/business-timezone";
import {
  formatVisitDateLabel,
  formatVisitTimeLabel,
} from "@/lib/visits/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type VisitStartsAtResult =
  | { ok: true; startsAt: string }
  | { ok: false; error: string };

/**
 * Canonical timestamptz from trader-entered visit_date + visit_time.
 * Interprets wall-clock time in Europe/London (GMT/BST).
 * Rejects nonexistent spring-gap and ambiguous autumn times.
 */
export function resolveVisitStartsAt(
  visitDate: string,
  visitTime: string | null | undefined
): VisitStartsAtResult {
  const date = visitDate.trim();
  if (!DATE_RE.test(date)) {
    return { ok: false, error: "Choose a visit date." };
  }
  const time = (visitTime ?? "").trim();
  const hhmm = TIME_RE.test(time) ? time : "00:00";
  const resolved = resolveLondonLocalDateTime(date, hhmm);
  if (!resolved.ok) {
    return { ok: false, error: resolved.message };
  }
  return { ok: true, startsAt: resolved.utcIso };
}

/**
 * Convenience for callers that already validated the slot.
 * Returns null when the local civil time is invalid or ambiguous.
 */
export function buildVisitStartsAt(
  visitDate: string,
  visitTime: string | null | undefined
): string | null {
  const resolved = resolveVisitStartsAt(visitDate, visitTime);
  return resolved.ok ? resolved.startsAt : null;
}

export function buildVisitSlotLabel(
  visitDate: string,
  visitTime: string | null | undefined
): string {
  const dateLabel = formatVisitDateLabel(visitDate);
  const timeLabel = formatVisitTimeLabel(visitTime);
  if (dateLabel && timeLabel) {
    return `${dateLabel} at ${timeLabel}`;
  }
  return dateLabel || timeLabel || "Date and time to be confirmed";
}
