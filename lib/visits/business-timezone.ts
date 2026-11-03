/**
 * Business appointment timezone for Reanvil traders (UK-first).
 * Appointment wall-clock times are Europe/London (GMT/BST).
 */
export const BUSINESS_TIME_ZONE = "Europe/London";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type LondonAppointmentResult =
  | { ok: true; utcIso: string }
  | {
      ok: false;
      code: "invalid_input" | "nonexistent" | "ambiguous";
      message: string;
    };

function readZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const hourRaw = get("hour");
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // en-GB 24h clock can yield "24" for midnight in some engines
    hour: Number(hourRaw === "24" ? "0" : hourRaw),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function partsMatchDesired(
  parts: ZonedParts,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): boolean {
  return (
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute
  );
}

/**
 * Convert a trader-entered local appointment (YYYY-MM-DD + HH:MM) in
 * Europe/London into a UTC ISO timestamptz string.
 *
 * Rejects nonexistent spring-gap times and ambiguous autumn fold times
 * so booking/reschedule never silently shift the trader's clock reading.
 */
export function resolveLondonLocalDateTime(
  visitDate: string,
  visitTime: string
): LondonAppointmentResult {
  const dateParts = visitDate.split("-").map(Number);
  const timeParts = visitTime.split(":").map(Number);
  if (
    dateParts.length !== 3 ||
    timeParts.length < 2 ||
    dateParts.some((n) => !Number.isFinite(n)) ||
    timeParts.some((n) => !Number.isFinite(n))
  ) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Enter a valid visit date and time.",
    };
  }

  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;

  // Initial guess: treat wall time as UTC, then correct using London offset.
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let pass = 0; pass < 3; pass += 1) {
    const parts = readZonedParts(new Date(utcMillis), BUSINESS_TIME_ZONE);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMillis += desired - asUtc;
  }

  const parts = readZonedParts(new Date(utcMillis), BUSINESS_TIME_ZONE);
  const matches = partsMatchDesired(parts, year, month, day, hour, minute);

  const earlier = utcMillis - 60 * 60 * 1000;
  const earlierParts = readZonedParts(new Date(earlier), BUSINESS_TIME_ZONE);
  const earlierMatches = partsMatchDesired(
    earlierParts,
    year,
    month,
    day,
    hour,
    minute
  );

  if (matches && earlierMatches) {
    return {
      ok: false,
      code: "ambiguous",
      message:
        "That time happens twice when UK clocks go back. Choose a different time (for example 00:30 or 02:30) so the appointment is clear.",
    };
  }

  if (!matches) {
    return {
      ok: false,
      code: "nonexistent",
      message:
        "That time does not exist when UK clocks go forward. Choose a time from 2:00am onwards on that morning.",
    };
  }

  return { ok: true, utcIso: new Date(utcMillis).toISOString() };
}

/** @deprecated Prefer resolveLondonLocalDateTime — throws on invalid DST times. */
export function londonLocalDateTimeToUtcIso(
  visitDate: string,
  visitTime: string
): string {
  const resolved = resolveLondonLocalDateTime(visitDate, visitTime);
  if (!resolved.ok) {
    throw new Error(resolved.message);
  }
  return resolved.utcIso;
}

export function formatLondonWallTimeFromUtcIso(
  utcIso: string
): { date: string; time: string } | null {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = readZonedParts(date, BUSINESS_TIME_ZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}
