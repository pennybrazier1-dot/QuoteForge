export const BOOKING_CONFIRMATIONS = ["provisional", "confirmed"] as const;

export type BookingConfirmation = (typeof BOOKING_CONFIRMATIONS)[number];

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
