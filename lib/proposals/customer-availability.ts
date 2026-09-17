import { parseDurationToCalendarDays } from "@/lib/calendar/job-span";
import { isLongDurationJob, requiredWorkingDays } from "@/lib/proposals/acceptance-rules";
import {
  resolveBookingWindow,
  slotFallsInsideWindow,
  type BookingWindow,
  type ResolvedBookingWindow,
} from "@/lib/proposals/booking-window";
import {
  isSlotTakenByOther,
  occupiesAvailability,
  type OccupiedWorkSlot,
} from "@/lib/proposals/slot-hold";

export type PublicScheduleMode = "range" | "appointment";

export type PublicAvailabilitySlot = {
  id: string;
  kind: PublicScheduleMode;
  startDate: string;
  endDate?: string;
  startTime?: string;
  workingDays?: number;
  label: string;
};

export type BusyCalendarSource = {
  proposalId: string;
  startDate: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: string | null;
  accepted?: boolean;
  dateState?: OccupiedWorkSlot["dateState"];
  holdKind?: OccupiedWorkSlot["holdKind"];
  holdCreatedAt?: string | null;
  /** Never sent to the customer. */
  customerName?: string | null;
  jobTitle?: string | null;
};

export type VisitBusySource = {
  id: string;
  visitDate: string | null;
  visitTime?: string | null;
  customerName?: string | null;
};

const APPOINTMENT_TIMES = ["10:00", "13:00", "09:00", "14:00"] as const;
const MAX_PUBLIC_SLOTS = 10;
export const INITIAL_PUBLIC_SLOTS = 5;

export function encodePublicSlotId(slot: {
  kind: PublicScheduleMode;
  startDate: string;
  endDate?: string;
  startTime?: string;
}): string {
  return [slot.kind, slot.startDate, slot.endDate ?? "", slot.startTime ?? ""].join(
    "|"
  );
}

export function decodePublicSlotId(
  value: string
): {
  kind: PublicScheduleMode;
  startDate: string;
  endDate?: string;
  startTime?: string;
} | null {
  const [kind, startDate, endDate, startTime] = value.split("|");
  if ((kind !== "range" && kind !== "appointment") || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return null;
  }
  return {
    kind,
    startDate,
    endDate: endDate || undefined,
    startTime: startTime || undefined,
  };
}

export function scheduleModeForDuration(
  estimatedDuration: string | null | undefined
): PublicScheduleMode {
  return isLongDurationJob(estimatedDuration) ? "range" : "appointment";
}

export function toOccupiedWorkSlots(
  sources: BusyCalendarSource[],
  now: Date = new Date()
): OccupiedWorkSlot[] {
  return sources
    .map((source) => {
      const startDate = source.startDate?.trim() || "";
      if (!startDate) {
        return null;
      }
      const spanDays = Math.max(1, parseDurationToCalendarDays(source.duration));
      const endDate =
        source.endDate?.trim() ||
        (spanDays > 1 ? addCalendarDays(startDate, spanDays - 1) : startDate);
      const slot: OccupiedWorkSlot = {
        proposalId: source.proposalId,
        startDate,
        endDate,
        startTime: source.startTime ?? null,
        accepted: source.accepted,
        dateState: source.dateState,
        holdKind: source.holdKind,
        holdCreatedAt: source.holdCreatedAt,
      };
      return occupiesAvailability(slot, now) ? slot : null;
    })
    .filter((slot): slot is OccupiedWorkSlot => Boolean(slot));
}

export function visitsToOccupiedSlots(visits: VisitBusySource[]): OccupiedWorkSlot[] {
  return visits
    .filter((visit) => Boolean(visit.visitDate?.trim()))
    .map((visit) => ({
      proposalId: `visit-${visit.id}`,
      startDate: visit.visitDate as string,
      endDate: visit.visitDate,
      startTime: visit.visitTime ?? null,
      accepted: true,
      dateState: "confirmed" as const,
      holdKind: "trader" as const,
    }));
}

export function splitPublicAvailability(slots: PublicAvailabilitySlot[]): {
  visible: PublicAvailabilitySlot[];
  more: PublicAvailabilitySlot[];
  hasMore: boolean;
} {
  return {
    visible: slots.slice(0, INITIAL_PUBLIC_SLOTS),
    more: slots.slice(INITIAL_PUBLIC_SLOTS),
    hasMore: slots.length > INITIAL_PUBLIC_SLOTS,
  };
}

export function buildPublicAvailability(input: {
  estimatedDuration?: string | null;
  occupied: OccupiedWorkSlot[];
  ignoreProposalId: string;
  fromDate?: Date;
  now?: Date;
  bookingWindow?: BookingWindow | null;
}): PublicAvailabilitySlot[] {
  const now = input.now ?? new Date();
  const window = resolveBookingWindow(input.bookingWindow, input.fromDate ?? now);
  const mode = scheduleModeForDuration(input.estimatedDuration);

  if (mode === "range") {
    return buildRangeSlots({
      workingDays: requiredWorkingDays(input.estimatedDuration),
      durationText: input.estimatedDuration,
      occupied: input.occupied,
      ignoreProposalId: input.ignoreProposalId,
      window,
      now,
    });
  }

  return buildAppointmentSlots({
    occupied: input.occupied,
    ignoreProposalId: input.ignoreProposalId,
    window,
    now,
  });
}

export function formatRangeLabel(startDate: string, endDate: string): string {
  const start = parseLocalIso(startDate);
  const end = parseLocalIso(endDate);
  if (!start || !end) {
    return `${startDate}–${endDate}`;
  }
  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(end);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${startDay}–${endDay} ${month}`;
  }
  const startMonth = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(start);
  return `${startDay} ${startMonth} – ${endDay} ${month}`;
}

export function formatAppointmentLabel(dateIso: string, timeHm: string): string {
  const date = parseLocalIso(dateIso);
  if (!date) {
    return `${dateIso} · ${timeHm}`;
  }
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  return `${weekday} ${day} ${month} · ${timeHm}`;
}

export function publicSlotHasPrivateData(slot: PublicAvailabilitySlot): boolean {
  const blob = `${slot.id} ${slot.label} ${slot.startDate} ${slot.endDate ?? ""} ${slot.startTime ?? ""}`;
  return /@|customer|job #|proposal|diary|calendar|held for/i.test(blob);
}

function buildRangeSlots(input: {
  workingDays: number;
  durationText?: string | null;
  occupied: OccupiedWorkSlot[];
  ignoreProposalId: string;
  window: ResolvedBookingWindow;
  now: Date;
}): PublicAvailabilitySlot[] {
  const needed = Math.max(2, input.workingDays);
  const slots: PublicAvailabilitySlot[] = [];
  const cursor = parseLocalIso(input.window.startDate);
  if (!cursor) {
    return [];
  }

  while (toLocalIso(cursor) <= input.window.endDate && slots.length < MAX_PUBLIC_SLOTS) {
    const startIso = toLocalIso(cursor);
    if (!isWeekend(cursor)) {
      const days = nextWorkingDays(startIso, needed);
      if (days.length === needed) {
        const endDate = days[days.length - 1];
        const candidate = { startDate: startIso, endDate };
        const blocked =
          !slotFallsInsideWindow(candidate, input.window) ||
          days.some((date) =>
            isSlotTakenByOther(
              { startDate: date, endDate: date },
              input.occupied,
              input.ignoreProposalId,
              input.now
            )
          );
        if (!blocked) {
          slots.push({
            id: encodePublicSlotId({
              kind: "range",
              startDate: startIso,
              endDate,
              startTime: "09:00",
            }),
            kind: "range",
            startDate: startIso,
            endDate,
            startTime: "09:00",
            workingDays: needed,
            label: formatCustomerRangeLabel(startIso, endDate, input.durationText),
          });
          cursor.setDate(cursor.getDate() + 1);
          const afterEnd = parseLocalIso(endDate);
          if (afterEnd) {
            afterEnd.setDate(afterEnd.getDate() + 1);
            cursor.setTime(afterEnd.getTime());
          }
          continue;
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

function buildAppointmentSlots(input: {
  occupied: OccupiedWorkSlot[];
  ignoreProposalId: string;
  window: ResolvedBookingWindow;
  now: Date;
}): PublicAvailabilitySlot[] {
  const slots: PublicAvailabilitySlot[] = [];
  const cursor = parseLocalIso(input.window.startDate);
  if (!cursor) {
    return [];
  }
  let timeIndex = 0;

  while (toLocalIso(cursor) <= input.window.endDate && slots.length < MAX_PUBLIC_SLOTS) {
    if (!isWeekend(cursor)) {
      const startDate = toLocalIso(cursor);
      const startTime = APPOINTMENT_TIMES[timeIndex % APPOINTMENT_TIMES.length];
      timeIndex += 1;
      const taken = isSlotTakenByOther(
        { startDate, endDate: startDate, startTime },
        input.occupied,
        input.ignoreProposalId,
        input.now
      );
      if (!taken) {
        slots.push({
          id: encodePublicSlotId({
            kind: "appointment",
            startDate,
            endDate: startDate,
            startTime,
          }),
          kind: "appointment",
          startDate,
          endDate: startDate,
          startTime,
          label: formatAppointmentLabel(startDate, startTime),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

function formatCustomerRangeLabel(
  startDate: string,
  endDate: string,
  durationText?: string | null
): string {
  const start = parseLocalIso(startDate);
  if (
    start &&
    start.getDay() === 1 &&
    /\bweeks?\b/i.test(durationText ?? "")
  ) {
    const day = start.getDate();
    const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(start);
    return `Week commencing ${day} ${month}`;
  }
  return formatRangeLabel(startDate, endDate);
}

function nextWorkingDays(startIso: string, count: number): string[] {
  const dates: string[] = [];
  const cursor = parseLocalIso(startIso);
  if (!cursor) {
    return [];
  }
  let guard = 0;
  while (dates.length < count && guard < 21) {
    if (!isWeekend(cursor)) {
      dates.push(toLocalIso(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return dates.length === count ? dates : [];
}

function addCalendarDays(iso: string, days: number): string {
  const date = parseLocalIso(iso);
  if (!date) {
    return iso;
  }
  date.setDate(date.getDate() + days);
  return toLocalIso(date);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function parseLocalIso(iso: string): Date | null {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function toLocalIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
