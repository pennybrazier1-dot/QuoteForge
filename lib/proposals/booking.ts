import { normalizeProposalStatus } from "@/lib/proposals/status";

export const BOOKING_CONFIRMATIONS = ["provisional", "confirmed"] as const;

export type BookingConfirmation = (typeof BOOKING_CONFIRMATIONS)[number];

/** Statuses that may appear on the calendar once sent and scheduled. */
export const CALENDAR_ELIGIBLE_STATUSES = [
  "waiting_for_customer",
  "needs_attention",
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
  return status === "booked" && bookingConfirmation === "confirmed";
}

export function isProvisionalBooking(
  status: string,
  bookingConfirmation: string | null | undefined
): boolean {
  return status === "booked" && bookingConfirmation === "provisional";
}

/**
 * Whether a proposal can appear on the calendar.
 * Ready to Send and drafts are excluded — only sent quotes with a start date qualify.
 */
export function isCalendarEligibleProposal(
  status: string,
  plannedStartDate: string | null | undefined
): boolean {
  const normalized = normalizeProposalStatus(status);

  if (!plannedStartDate?.trim()) {
    return false;
  }

  if (normalized === "draft" || normalized === "ready_to_send") {
    return false;
  }

  if (
    normalized === "completed" ||
    normalized === "cancelled" ||
    normalized === "declined" ||
    normalized === "expired"
  ) {
    return false;
  }

  return (CALENDAR_ELIGIBLE_STATUSES as readonly string[]).includes(normalized);
}

/**
 * Calendar colour for a scheduled proposal.
 * Amber holds the date while waiting for the customer or tradesperson confirmation.
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

  if (normalized === "waiting_for_customer" || normalized === "needs_attention") {
    return "provisional";
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
