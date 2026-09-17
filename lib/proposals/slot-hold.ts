export const TEMP_HOLD_MS = 20 * 60 * 1000;
export const TEMP_HOLD_ACTION = "temp_slot_hold";

export type SlotHoldKind = "trader" | "customer_temp";

export type OccupiedWorkSlot = {
  proposalId: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  accepted?: boolean;
  dateState?: "none" | "provisional" | "confirmed";
  holdKind?: SlotHoldKind | null;
  holdCreatedAt?: string | null;
};

export function holdExpiresAt(
  createdAt: string | Date,
  ttlMs = TEMP_HOLD_MS
): string {
  const created =
    createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  return new Date(created + ttlMs).toISOString();
}

export function isTemporaryHoldExpired(
  holdCreatedAt: string | null | undefined,
  now: Date = new Date(),
  ttlMs = TEMP_HOLD_MS
): boolean {
  if (!holdCreatedAt) {
    return true;
  }
  const created = new Date(holdCreatedAt).getTime();
  if (Number.isNaN(created)) {
    return true;
  }
  return now.getTime() - created >= ttlMs;
}

export function isActiveTemporaryHold(
  hold: Pick<OccupiedWorkSlot, "holdKind" | "holdCreatedAt">,
  now: Date = new Date()
): boolean {
  if (hold.holdKind !== "customer_temp") {
    return false;
  }
  return !isTemporaryHoldExpired(hold.holdCreatedAt, now);
}

/**
 * A diary slot is busy when it is a booked/confirmed job, a trader hold,
 * or a customer temp hold that has not expired.
 * Expired temp holds never become jobs.
 */
export function occupiesAvailability(
  slot: OccupiedWorkSlot,
  now: Date = new Date()
): boolean {
  if (!slot.startDate?.trim()) {
    return false;
  }

  if (slot.accepted && slot.dateState === "confirmed") {
    return true;
  }

  if (slot.dateState === "confirmed") {
    return true;
  }

  if (slot.dateState === "provisional") {
    if (slot.holdKind === "customer_temp") {
      return isActiveTemporaryHold(slot, now);
    }
    return true;
  }

  return false;
}

export function sameWorkSlot(
  left: Pick<OccupiedWorkSlot, "startDate" | "endDate" | "startTime">,
  right: Pick<OccupiedWorkSlot, "startDate" | "endDate" | "startTime">
): boolean {
  return (
    (left.startDate || "") === (right.startDate || "") &&
    (left.endDate || "") === (right.endDate || "") &&
    (left.startTime || "") === (right.startTime || "")
  );
}

export function isSlotTakenByOther(
  candidate: Pick<OccupiedWorkSlot, "startDate" | "endDate" | "startTime">,
  occupied: OccupiedWorkSlot[],
  ignoreProposalId: string,
  now: Date = new Date()
): boolean {
  return occupied.some(
    (slot) =>
      slot.proposalId !== ignoreProposalId &&
      occupiesAvailability(slot, now) &&
      overlapsWorkSlot(candidate, slot)
  );
}

export function overlapsWorkSlot(
  left: Pick<OccupiedWorkSlot, "startDate" | "endDate" | "startTime">,
  right: Pick<OccupiedWorkSlot, "startDate" | "endDate" | "startTime">
): boolean {
  const leftDates = expandInclusiveDates(left.startDate, left.endDate || left.startDate);
  const rightDates = expandInclusiveDates(
    right.startDate,
    right.endDate || right.startDate
  );
  const shared = leftDates.some((date) => rightDates.includes(date));
  if (!shared) {
    return false;
  }

  const leftTime = left.startTime?.trim() || "";
  const rightTime = right.startTime?.trim() || "";
  if (!leftTime || !rightTime) {
    return true;
  }
  return leftTime === rightTime;
}

function expandInclusiveDates(start: string, end: string): string[] {
  if (!start) {
    return [];
  }
  if (!end || end === start) {
    return [start];
  }

  const dates: string[] = [];
  const cursor = parseLocalIso(start);
  const last = parseLocalIso(end);
  if (!cursor || !last) {
    return [start];
  }

  while (cursor.getTime() <= last.getTime()) {
    dates.push(toLocalIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
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
