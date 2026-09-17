import {
  hasExactStartDate,
  isBookedJob,
  isProposalAcceptedStatus,
  readDateSlotState,
  type DateSlotState,
} from "@/lib/proposals/date-workflow";
import { parseDurationToCalendarDays } from "@/lib/calendar/job-span";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function hasExactStartTime(
  plannedStartTime: string | null | undefined
): boolean {
  return TIME_PATTERN.test(plannedStartTime?.trim() ?? "");
}

/**
 * Longer jobs are booked as a continuous working-day window.
 * Hour/minute durations stay as appointment slots.
 */
export function isLongDurationJob(
  estimatedDuration: string | null | undefined
): boolean {
  const text = estimatedDuration?.trim() ?? "";
  if (!text) {
    return false;
  }

  const hourOrMinuteOnly =
    /\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/i.test(text) &&
    !/\b(days?|working\s+days?|weeks?)\b/i.test(text);
  if (hourOrMinuteOnly) {
    return false;
  }

  return parseDurationToCalendarDays(text) >= 2;
}

export function requiredWorkingDays(
  estimatedDuration: string | null | undefined
): number {
  if (!isLongDurationJob(estimatedDuration)) {
    return 1;
  }
  return parseDurationToCalendarDays(estimatedDuration);
}

/**
 * Rough wording such as "October" or "within 4 weeks" is not bookable.
 * A real work date must be an ISO calendar date, plus a time for short jobs.
 */
export function hasExactWorkSchedule(input: {
  plannedStartDate?: string | null;
  plannedStartTime?: string | null;
  estimatedDuration?: string | null;
}): boolean {
  if (!hasExactStartDate(input.plannedStartDate)) {
    return false;
  }
  if (isLongDurationJob(input.estimatedDuration)) {
    return true;
  }
  return hasExactStartTime(input.plannedStartTime);
}

export function canShowFinalAccept(input: {
  canRespond: boolean;
  plannedStartDate?: string | null;
  plannedStartTime?: string | null;
  estimatedDuration?: string | null;
}): boolean {
  return (
    input.canRespond &&
    hasExactWorkSchedule({
      plannedStartDate: input.plannedStartDate,
      plannedStartTime: input.plannedStartTime,
      estimatedDuration: input.estimatedDuration,
    })
  );
}

/** Customer acceptance of the proposal also confirms the selected work slot. */
export function bookingConfirmationAfterCustomerAccept(
  hasExactSchedule: boolean
): "confirmed" | null {
  return hasExactSchedule ? "confirmed" : null;
}

export function isBookedJobFromParts(input: {
  status: string;
  acceptedAt?: string | null;
  bookingConfirmation?: string | null;
  plannedStartDate?: string | null;
}): boolean {
  const accepted = isProposalAcceptedStatus(input.status, input.acceptedAt);
  const dateState = readDateSlotState(
    input.bookingConfirmation,
    input.plannedStartDate
  );
  return isBookedJob(accepted, dateState);
}

export function traderAcceptingRequestedDateBooksJob(input: {
  customerRequestedExactSlot: boolean;
  traderAgrees: boolean;
  otherProposalDetailsChanged: boolean;
}): boolean {
  return (
    input.customerRequestedExactSlot &&
    input.traderAgrees &&
    !input.otherProposalDetailsChanged
  );
}

export function revisedProposalRequiresReaccept(input: {
  changeKind: "scope" | "materials" | "price" | "quantities" | "job_details" | "date";
}): boolean {
  return input.changeKind !== "date";
}

export function waitingForCustomerAcceptance(input: {
  status: string;
  acceptedAt?: string | null;
  bookingConfirmation?: string | null;
  plannedStartDate?: string | null;
}): boolean {
  const accepted = isProposalAcceptedStatus(input.status, input.acceptedAt);
  const dateState: DateSlotState = readDateSlotState(
    input.bookingConfirmation,
    input.plannedStartDate
  );
  return !accepted && dateState === "confirmed";
}
