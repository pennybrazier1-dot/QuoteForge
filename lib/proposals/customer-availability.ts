import { parseDurationToCalendarDays } from "@/lib/calendar/job-span";
import { isLongDurationJob, requiredWorkingDays } from "@/lib/proposals/acceptance-rules";
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

const APPOINTMENT_TIMES = ["09:00", "12:00", "13:00", "16:00"] as const;
const RANGE_HORIZON_DAYS = 56;
const APPOINTMENT_HORIZON_DAYS = 28;
const MAX_PUBLIC_SLOTS = 12;

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

export function buildPublicAvailability(input: {
  estimatedDuration?: string | null;
  occupied: OccupiedWorkSlot[];
  ignoreProposalId: string;
  fromDate?: Date;
  now?: Date;
}): PublicAvailabilitySlot[] {
  const now = input.now ?? new Date();
  const from = startOfLocalDay(input.fromDate ?? now);
  const mode = scheduleModeForDuration(input.estimatedDuration);

  if (mode === "range") {
    return buildRangeSlots({
      workingDays: requiredWorkingDays(input.estimatedDuration),
      occupied: input.occupied,
      ignoreProposalId: input.ignoreProposalId,
      from,
      now,
    });
  }

  return buildAppointmentSlots({
    occupied: input.occupied,
    ignoreProposalId: input.ignoreProposalId,
    from,
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
  occupied: OccupiedWorkSlot[];
  ignoreProposalId: string;
  from: Date;
  now: Date;
}): PublicAvailabilitySlot[] {
  const needed = Math.max(2, input.workingDays);
  const slots: PublicAvailabilitySlot[] = [];
  const cursor = new Date(input.from);
  cursor.setDate(cursor.getDate() + 1);

  for (let i = 0; i < RANGE_HORIZON_DAYS && slots.length < MAX_PUBLIC_SLOTS; i += 1) {
    const startIso = toLocalIso(cursor);
    if (!isWeekend(cursor)) {
      const window = nextWorkingDays(startIso, needed);
      if (window.length === needed) {
        const endDate = window[window.length - 1];
        const blocked = window.some((date) =>
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
            label: formatRangeLabel(startIso, endDate),
          });
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
  from: Date;
  now: Date;
}): PublicAvailabilitySlot[] {
  const slots: PublicAvailabilitySlot[] = [];
  const cursor = new Date(input.from);
  cursor.setDate(cursor.getDate() + 1);

  for (let i = 0; i < APPOINTMENT_HORIZON_DAYS && slots.length < MAX_PUBLIC_SLOTS; i += 1) {
    if (!isWeekend(cursor)) {
      const startDate = toLocalIso(cursor);
      for (const startTime of APPOINTMENT_TIMES) {
        if (slots.length >= MAX_PUBLIC_SLOTS) {
          break;
        }
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
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
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

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
