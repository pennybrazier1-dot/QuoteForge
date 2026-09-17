export const BOOKING_WINDOW_KINDS = [
  "next_2_weeks",
  "next_month",
  "specific_month",
  "custom",
] as const;

export type BookingWindowKind = (typeof BOOKING_WINDOW_KINDS)[number];

export type BookingWindow = {
  kind: BookingWindowKind;
  month?: string;
  startDate?: string;
  endDate?: string;
};

export type ResolvedBookingWindow = {
  startDate: string;
  endDate: string;
  label: string;
  kind: BookingWindowKind;
};

export const DEFAULT_BOOKING_WINDOW: BookingWindow = {
  kind: "next_month",
};

export function isBookingWindowKind(value: string): value is BookingWindowKind {
  return (BOOKING_WINDOW_KINDS as readonly string[]).includes(value);
}

export function parseBookingWindow(value: unknown): BookingWindow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isBookingWindowKind(String(record.kind ?? ""))) {
    return null;
  }
  return {
    kind: record.kind as BookingWindowKind,
    month: typeof record.month === "string" ? record.month : undefined,
    startDate: typeof record.startDate === "string" ? record.startDate : undefined,
    endDate: typeof record.endDate === "string" ? record.endDate : undefined,
  };
}

export function parseBookingWindowFromForm(formData: FormData): BookingWindow {
  const kindRaw = String(formData.get("bookingWindowKind") ?? "").trim();
  const kind = isBookingWindowKind(kindRaw) ? kindRaw : DEFAULT_BOOKING_WINDOW.kind;
  return {
    kind,
    month: String(formData.get("bookingWindowMonth") ?? "").trim() || undefined,
    startDate: String(formData.get("bookingWindowStart") ?? "").trim() || undefined,
    endDate: String(formData.get("bookingWindowEnd") ?? "").trim() || undefined,
  };
}

export function resolveBookingWindow(
  window: BookingWindow | null | undefined,
  now: Date = new Date()
): ResolvedBookingWindow {
  const resolved = window ?? DEFAULT_BOOKING_WINDOW;
  const tomorrow = addDays(startOfLocalDay(now), 1);

  if (resolved.kind === "next_2_weeks") {
    const end = addDays(startOfLocalDay(now), 14);
    return pack("next_2_weeks", tomorrow, end);
  }

  if (resolved.kind === "specific_month" && isYearMonth(resolved.month)) {
    const [year, month] = resolved.month.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return pack(
      "specific_month",
      start < tomorrow ? tomorrow : start,
      end,
      formatMonthLabel(start)
    );
  }

  if (
    resolved.kind === "custom" &&
    isIsoDate(resolved.startDate) &&
    isIsoDate(resolved.endDate)
  ) {
    const start = parseLocalIso(resolved.startDate);
    const end = parseLocalIso(resolved.endDate);
    const from = start < tomorrow ? tomorrow : start;
    return pack("custom", from, end);
  }

  const end = addDays(startOfLocalDay(now), 30);
  return pack("next_month", tomorrow, end);
}

export function formatBookingWindowLabel(window: ResolvedBookingWindow): string {
  return window.label;
}

export function slotFallsInsideWindow(
  slot: { startDate: string; endDate?: string },
  window: ResolvedBookingWindow
): boolean {
  const start = slot.startDate;
  const end = slot.endDate ?? slot.startDate;
  return start >= window.startDate && end <= window.endDate;
}

function pack(
  kind: BookingWindowKind,
  start: Date,
  end: Date,
  label?: string
): ResolvedBookingWindow {
  const startDate = toLocalIso(start);
  const endDate = toLocalIso(end);
  return {
    kind,
    startDate,
    endDate,
    label: label ?? formatRange(start, end),
  };
}

function formatRange(start: Date, end: Date): string {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const endMonth = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(end);
  const startMonth = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(start);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${startDay}–${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function parseLocalIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toLocalIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isIsoDate(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isYearMonth(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}
