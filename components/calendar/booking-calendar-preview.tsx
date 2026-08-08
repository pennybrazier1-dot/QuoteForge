"use client";

import {
  buildWeekDays,
  getJobsForDate,
  parseIsoDate,
  type CalendarJob,
} from "@/lib/calendar/calendar-data";

type BookingCalendarPreviewProps = {
  anchorDateIso: string | null;
  proposedSpanDates: string[];
  existingJobs: CalendarJob[];
  onSelectDate?: (isoDate: string) => void;
};

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function BookingCalendarPreview({
  anchorDateIso,
  proposedSpanDates,
  existingJobs,
  onSelectDate,
}: BookingCalendarPreviewProps) {
  const fallbackAnchor = toLocalIsoDate(new Date());
  const activeAnchor = anchorDateIso || fallbackAnchor;
  const weekDays = buildWeekDays(parseIsoDate(activeAnchor));
  const proposedSet = new Set(proposedSpanDates);

  return (
    <div className="qf-booking-preview">
      <p className="qf-booking-preview-label">Your availability this week</p>
      {!anchorDateIso ? (
        <p className="qf-booking-preview-hint">
          Choose a date below (or use the date picker). Nothing is saved until
          you confirm.
        </p>
      ) : null}
      <div className="qf-booking-preview-week">
        {weekDays.map((day) => {
          const dayJobs = getJobsForDate(existingJobs, day.iso);
          const isProposed = proposedSet.has(day.iso);
          const confirmedCount = dayJobs.filter(
            (job) => job.tone === "confirmed"
          ).length;
          const provisionalCount = dayJobs.filter(
            (job) => job.tone === "provisional"
          ).length;
          const dayClass = `qf-booking-preview-day ${
            isProposed ? "qf-booking-preview-day-proposed" : ""
          }${onSelectDate ? " qf-booking-preview-day-selectable" : ""}`;

          if (onSelectDate) {
            return (
              <button
                key={day.iso}
                type="button"
                className={dayClass}
                onClick={() => onSelectDate(day.iso)}
                aria-pressed={isProposed}
                aria-label={`Select ${day.iso}`}
              >
                <span className="qf-booking-preview-weekday">
                  {day.weekdayShort}
                </span>
                <span className="qf-booking-preview-daynum">{day.dayNumber}</span>
                <div className="qf-booking-preview-dots">
                  {confirmedCount > 0 ? (
                    <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
                  ) : null}
                  {provisionalCount > 0 ? (
                    <span className="qf-calendar-dot qf-calendar-dot-provisional" />
                  ) : null}
                  {isProposed ? (
                    <span
                      className="qf-booking-preview-proposed-mark"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              </button>
            );
          }

          return (
            <div key={day.iso} className={dayClass}>
              <span className="qf-booking-preview-weekday">{day.weekdayShort}</span>
              <span className="qf-booking-preview-daynum">{day.dayNumber}</span>
              <div className="qf-booking-preview-dots">
                {confirmedCount > 0 ? (
                  <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
                ) : null}
                {provisionalCount > 0 ? (
                  <span className="qf-calendar-dot qf-calendar-dot-provisional" />
                ) : null}
                {isProposed ? (
                  <span
                    className="qf-booking-preview-proposed-mark"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="qf-booking-preview-legend">
        <span className="qf-booking-preview-legend-item">
          <span className="qf-booking-preview-proposed-swatch" />
          This booking
        </span>
        <span className="qf-booking-preview-legend-item">
          <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
          Confirmed
        </span>
        <span className="qf-booking-preview-legend-item">
          <span className="qf-calendar-dot qf-calendar-dot-provisional" />
          Provisional
        </span>
      </div>
    </div>
  );
}
