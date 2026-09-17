import {
  buildDateWorkflowSnapshot,
  isBookedJob as isBookedJobState,
} from "@/lib/proposals/date-workflow";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export const BOOKING_CONFIRMATIONS = ["provisional", "confirmed"] as const;

export type BookingConfirmation = (typeof BOOKING_CONFIRMATIONS)[number];

/** Only accepted proposals may appear on the actual job calendar. */
export const CALENDAR_ELIGIBLE_STATUSES = [
  "booked",
] as const;

export function isBookingConfirmation(
  value: string | null | undefined
): value is BookingConfirmation {
  return (
    value === "provisional" ||
    value === "confirmed"
  );
}

export function isConfirmedBooking(
  status: string,
  bookingConfirmation: string | null | undefined,
  plannedStartDate?: string | null
): boolean {
  if (plannedStartDate === undefined) {
    return (
      normalizeProposalStatus(status) === "booked" &&
      bookingConfirmation === "confirmed"
    );
  }

  const snapshot = buildDateWorkflowSnapshot({
    status,
    bookingConfirmation,
    plannedStartDate,
  });
  return snapshot.isBookedJob;
}

export function isProvisionalBooking(
  status: string,
  bookingConfirmation: string | null | undefined,
  plannedStartDate?: string | null
): boolean {
  if (plannedStartDate === undefined) {
    return bookingConfirmation === "provisional";
  }

  const snapshot = buildDateWorkflowSnapshot({
    status,
    bookingConfirmation,
    plannedStartDate,
  });
  return snapshot.waitingForDateConfirmation;
}

/** Accepted proposal that still needs a confirmed job date. */
export function needsBookingConfirmation(
  status: string,
  bookingConfirmation: string | null | undefined,
  plannedStartDate?: string | null
): boolean {
  const snapshot = buildDateWorkflowSnapshot({
    status,
    bookingConfirmation,
    plannedStartDate,
  });
  return snapshot.needsScheduleJob;
}

/**
 * Whether a proposal can appear on the calendar as a confirmed booked job.
 * Green only when the proposal is accepted AND the date is confirmed.
 */
export function isCalendarEligibleProposal(
  status: string,
  plannedStartDate: string | null | undefined,
  bookingConfirmation?: string | null
): boolean {
  if (!plannedStartDate?.trim()) {
    return false;
  }

  const snapshot = buildDateWorkflowSnapshot({
    status,
    bookingConfirmation,
    plannedStartDate,
  });
  return isBookedJobState(snapshot.proposalAccepted, snapshot.dateState);
}

/**
 * A reserved diary slot that is not yet a booked job.
 * Requires an exact start time and an explicit hold or confirmed-unaccepted date.
 */
export function isCalendarHoldEligible(
  status: string,
  plannedStartDate: string | null | undefined,
  plannedStartTime?: string | null | undefined,
  bookingConfirmation?: string | null
): boolean {
  if (!plannedStartDate?.trim() || !plannedStartTime?.trim()) {
    return false;
  }

  const snapshot = buildDateWorkflowSnapshot({
    status,
    bookingConfirmation,
    plannedStartDate,
    plannedStartTime,
  });

  if (snapshot.isBookedJob || snapshot.dateState === "none") {
    return false;
  }

  return (
    snapshot.dateState === "provisional" || snapshot.dateState === "confirmed"
  );
}

/**
 * Calendar colour for a scheduled proposal.
 * Amber is a provisional hold. Green is only a confirmed booked job.
 */
export function getCalendarBookingTone(
  status: string,
  bookingConfirmation: string | null | undefined,
  plannedStartDate?: string | null
): BookingConfirmation | null {
  const snapshot = buildDateWorkflowSnapshot({
    status,
    bookingConfirmation,
    plannedStartDate,
  });

  if (snapshot.isBookedJob) {
    return "confirmed";
  }

  if (snapshot.dateState === "provisional" || snapshot.waitingForProposalAcceptance) {
    return "provisional";
  }

  if (plannedStartDate === undefined && normalizeProposalStatus(status) === "booked") {
    if (bookingConfirmation === "provisional") {
      return "provisional";
    }
    if (bookingConfirmation === "confirmed") {
      return "confirmed";
    }
  }

  return null;
}

export function formatBookingConfirmation(
  value: string | null | undefined
): string {
  if (value === "confirmed") {
    return "Confirmed";
  }

  if (value === "provisional") {
    return "Provisional";
  }

  return "Unscheduled";
}
