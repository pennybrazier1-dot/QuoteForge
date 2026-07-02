const MAX_CALENDAR_SPAN_DAYS = 60;

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Turn free-text estimated duration into a number of calendar days the job spans.
 * Defaults to 1 day when duration is missing or cannot be parsed.
 */
export function parseDurationToCalendarDays(
  duration: string | null | undefined
): number {
  if (!duration?.trim()) {
    return 1;
  }

  const text = duration.trim().toLowerCase();

  if (
    /cannot yet be determined|not specified|unknown|tbc|to be confirm/.test(
      text
    )
  ) {
    return 1;
  }

  if (/half[\s-]*(?:a\s*)?day/.test(text)) {
    return 1;
  }

  const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = numberMatch
    ? Math.max(1, Math.ceil(Number(numberMatch[1])))
    : 1;

  if (/\bmonths?\b/.test(text)) {
    return Math.min(amount * 30, MAX_CALENDAR_SPAN_DAYS);
  }

  if (/\bweeks?\b/.test(text)) {
    return Math.min(amount * 7, MAX_CALENDAR_SPAN_DAYS);
  }

  return Math.min(amount, MAX_CALENDAR_SPAN_DAYS);
}

/** Inclusive list of ISO dates from start for dayCount calendar days. */
export function expandJobSpanDates(
  startIso: string,
  dayCount: number
): string[] {
  const safeCount = Math.max(1, Math.min(dayCount, MAX_CALENDAR_SPAN_DAYS));
  const start = parseIsoDate(startIso);
  const dates: string[] = [];

  for (let offset = 0; offset < safeCount; offset += 1) {
    const next = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + offset
    );
    dates.push(toIsoDate(next));
  }

  return dates;
}

export function formatSpanLabel(
  spanDates: string[],
  dateIso: string
): string | null {
  if (spanDates.length <= 1) {
    return null;
  }

  const index = spanDates.indexOf(dateIso);

  if (index === 0) {
    return `Starts · ${spanDates.length} days`;
  }

  if (index > 0) {
    return `Day ${index + 1} of ${spanDates.length}`;
  }

  return null;
}
