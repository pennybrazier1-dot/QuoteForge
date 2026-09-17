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
  bookingConfirmation: string | null | undefined
): boolean {
  return (
    normalizeProposalStatus(status) === "booked" &&
    bookingConfirmation === "confirmed"
  );
}

export function isProvisionalBooking(
  status: string,
  bookingConfirmation: string | null | undefined
): boolean {
  return (
    normalizeProposalStatus(status) === "booked" &&
    bookingConfirmation === "provisional"
  );
}

/** Accepted quote that still needs the tradesperson to firm up the booking. */
export function needsBookingConfirmation(
  status: string,
  bookingConfirmation: string | null | undefined
): boolean {
  return isProvisionalBooking(status, bookingConfirmation);
}

/**
 * Whether a proposal can appear on the calendar as a job.
 * Proposal discussions never become jobs. Only an accepted proposal
 * with a real start date qualifies.
 */
export function isCalendarEligibleProposal(
  status: string,
  plannedStartDate: string | null | undefined
): boolean {
  const normalized = normalizeProposalStatus(status);

  if (!plannedStartDate?.trim()) {
    return false;
  }

  return (CALENDAR_ELIGIBLE_STATUSES as readonly string[]).includes(normalized);
}

const CALENDAR_HOLD_STATUSES = [
  "waiting_for_customer",
  "needs_attention",
] as const;

/**
 * A trader-held date before acceptance. This is not a job.
 * Requires an exact start time so quote discussion dates stay off the calendar.
 */
export function isCalendarHoldEligible(
  status: string,
  plannedStartDate: string | null | undefined,
  plannedStartTime?: string | null | undefined
): boolean {
  if (!plannedStartDate?.trim() || !plannedStartTime?.trim()) {
    return false;
  }

  const normalized = normalizeProposalStatus(status);
  return (CALENDAR_HOLD_STATUSES as readonly string[]).includes(normalized);
}

/**
 * Calendar colour for a scheduled proposal.
 * Amber holds a date after proposal acceptance while the trader confirms it.
 * Green means the booking date is confirmed.
 */
export function getCalendarBookingTone(
  status: string,
  bookingConfirmation: string | null | undefined
): BookingConfirmation | null {
  const normalized = normalizeProposalStatus(status);

  if (normalized === "booked") {
    if (bookingConfirmation === "provisional") {
      return "provisional";
    }

    return "confirmed";
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
