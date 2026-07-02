"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import {
  confirmBooking,
  type LifecycleActionState,
} from "@/app/proposals/lifecycle-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { PlannedStartDateFields } from "@/components/proposals/planned-start-date-fields";
import {
  BOOKING_CONFIRMATIONS,
  formatBookingConfirmation,
  type BookingConfirmation,
} from "@/lib/proposals/booking";
import { plannedStartFromDb } from "@/lib/proposals/planned-start-date";

const confirmInitialState: LifecycleActionState = {};

function SubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-primary"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

type BookingDialogProps = {
  mode: "accept" | "confirm";
  open: boolean;
  onClose: () => void;
  proposalId: string;
  plannedStartDateText: string | null;
  plannedStartDate: string | null;
  estimatedDuration: string | null;
  bookingConfirmation?: BookingConfirmation | null;
};

export function BookingDialog({
  mode,
  open,
  onClose,
  proposalId,
  plannedStartDateText,
  plannedStartDate,
  estimatedDuration,
  bookingConfirmation = "confirmed",
}: BookingDialogProps) {
  const [confirmState, confirmAction] = useActionState(
    confirmBooking,
    confirmInitialState
  );
  const [mounted, setMounted] = useState(false);
  const plannedStart = plannedStartFromDb({
    planned_start_date_text: plannedStartDateText,
    planned_start_date: plannedStartDate,
  });
  const [startText, setStartText] = useState(plannedStart.plannedStartDate);
  const [startExact, setStartExact] = useState(plannedStart.plannedStartDateExact);
  const [duration, setDuration] = useState(estimatedDuration ?? "");
  const [bookingStatus, setBookingStatus] = useState<BookingConfirmation>(
    bookingConfirmation ?? "confirmed"
  );

  const isAccept = mode === "accept";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const planned = plannedStartFromDb({
      planned_start_date_text: plannedStartDateText,
      planned_start_date: plannedStartDate,
    });

    setStartText(planned.plannedStartDate);
    setStartExact(planned.plannedStartDateExact);
    setDuration(estimatedDuration ?? "");
    setBookingStatus(bookingConfirmation ?? "confirmed");
  }, [
    open,
    plannedStartDateText,
    plannedStartDate,
    estimatedDuration,
    bookingConfirmation,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="qf-mgmt-dialog-root qf-mgmt-dialog-root-sheet" role="presentation">
      <button
        type="button"
        className="qf-mgmt-dialog-overlay"
        aria-label="Close booking dialog"
        onClick={onClose}
      />
      <div
        className="qf-mgmt-dialog-panel qf-mgmt-dialog-panel-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qf-booking-title"
      >
        <header className="qf-mgmt-dialog-sheet-header">
          <div>
            <h2 id="qf-booking-title" className="qf-mgmt-dialog-title">
              {isAccept ? "Mark accepted — confirm booking" : "Confirm booking"}
            </h2>
            <p className="qf-mgmt-dialog-subtitle">
              {isAccept
                ? "The customer accepted this quote. Check the start date, duration, and booking status before adding it to your calendar."
                : "Check the start date, duration, and booking status to firm up this job on your calendar."}
            </p>
          </div>
          <button
            type="button"
            className="qf-mgmt-dialog-close"
            aria-label="Close"
            onClick={onClose}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form action={confirmAction} className="qf-mgmt-dialog-sheet-form">
          <input type="hidden" name="proposalId" value={proposalId} />

          <div className="qf-mgmt-dialog-sheet-body">
            {confirmState.error ? <AuthError message={confirmState.error} /> : null}

            <PlannedStartDateFields
              textValue={startText}
              exactValue={startExact}
              onTextChange={setStartText}
              onExactChange={setStartExact}
            />

            <div>
              <label htmlFor="booking-duration" className="qf-field-label">
                Estimated duration
              </label>
              <input
                id="booking-duration"
                name="estimatedDuration"
                type="text"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="e.g. 2–3 days"
                className="form-input mt-2"
              />
            </div>

            <div>
              <label htmlFor="booking-confirmation" className="qf-field-label">
                Booking status
              </label>
              <select
                id="booking-confirmation"
                name="bookingConfirmation"
                value={bookingStatus}
                onChange={(event) =>
                  setBookingStatus(event.target.value as BookingConfirmation)
                }
                className="form-input mt-2"
              >
                {BOOKING_CONFIRMATIONS.map((value) => (
                  <option key={value} value={value}>
                    {formatBookingConfirmation(value)}
                    {value === "confirmed"
                      ? " — green on calendar"
                      : " — amber on calendar"}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted">
                Confirmed bookings appear in green. Provisional holds the date
                in amber until you firm it up.
              </p>
            </div>
          </div>

          <footer className="qf-mgmt-dialog-sheet-footer">
            <button
              type="button"
              className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <SubmitButton
              idleLabel={isAccept ? "Add to calendar" : "Confirm booking"}
              pendingLabel={isAccept ? "Adding…" : "Confirming…"}
            />
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
