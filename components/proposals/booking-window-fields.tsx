"use client";

import type { BookingWindow, BookingWindowKind } from "@/lib/proposals/booking-window";
import { DEFAULT_BOOKING_WINDOW } from "@/lib/proposals/booking-window";

const OPTIONS: Array<{ kind: BookingWindowKind; label: string }> = [
  { kind: "next_2_weeks", label: "Next 2 weeks" },
  { kind: "next_month", label: "Next month" },
  { kind: "specific_month", label: "Choose month" },
  { kind: "custom", label: "Custom range" },
];

export function BookingWindowFields({
  value,
  onChange,
}: {
  value?: BookingWindow | null;
  onChange: (value: BookingWindow) => void;
}) {
  const current = value ?? DEFAULT_BOOKING_WINDOW;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="bookingWindowKind" className="qf-field-label">
          Customer booking window
        </label>
        <select
          id="bookingWindowKind"
          name="bookingWindowKind"
          className="form-select mt-2"
          value={current.kind}
          onChange={(event) =>
            onChange({
              ...current,
              kind: event.target.value as BookingWindowKind,
            })
          }
        >
          {OPTIONS.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          Customers only see available slots inside this period. They never see
          your diary.
        </p>
      </div>

      {current.kind === "specific_month" ? (
        <div>
          <label htmlFor="bookingWindowMonth" className="qf-field-label">
            Month
          </label>
          <input
            id="bookingWindowMonth"
            name="bookingWindowMonth"
            type="month"
            className="form-input mt-2"
            value={current.month ?? ""}
            onChange={(event) =>
              onChange({ ...current, month: event.target.value })
            }
          />
        </div>
      ) : null}

      {current.kind === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bookingWindowStart" className="qf-field-label">
              From
            </label>
            <input
              id="bookingWindowStart"
              name="bookingWindowStart"
              type="date"
              className="form-input mt-2"
              value={current.startDate ?? ""}
              onChange={(event) =>
                onChange({ ...current, startDate: event.target.value })
              }
            />
          </div>
          <div>
            <label htmlFor="bookingWindowEnd" className="qf-field-label">
              To
            </label>
            <input
              id="bookingWindowEnd"
              name="bookingWindowEnd"
              type="date"
              className="form-input mt-2"
              value={current.endDate ?? ""}
              onChange={(event) =>
                onChange({ ...current, endDate: event.target.value })
              }
            />
          </div>
        </div>
      ) : null}

      {current.kind !== "specific_month" ? (
        <input type="hidden" name="bookingWindowMonth" value={current.month ?? ""} />
      ) : null}
      {current.kind !== "custom" ? (
        <>
          <input
            type="hidden"
            name="bookingWindowStart"
            value={current.startDate ?? ""}
          />
          <input
            type="hidden"
            name="bookingWindowEnd"
            value={current.endDate ?? ""}
          />
        </>
      ) : null}
    </div>
  );
}
