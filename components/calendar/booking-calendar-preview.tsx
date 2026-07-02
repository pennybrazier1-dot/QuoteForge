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
};

export function BookingCalendarPreview({
  anchorDateIso,
  proposedSpanDates,
  existingJobs,
}: BookingCalendarPreviewProps) {
  if (!anchorDateIso) {
    return (
      <div className="qf-booking-preview qf-booking-preview-empty">
        <p className="qf-booking-preview-label">Calendar preview</p>
        <p className="qf-booking-preview-hint">
          Add an exact calendar date to see how this booking fits your week.
        </p>
      </div>
    );
  }

  const weekDays = buildWeekDays(parseIsoDate(anchorDateIso));
  const proposedSet = new Set(proposedSpanDates);

  return (
    <div className="qf-booking-preview">
      <p className="qf-booking-preview-label">This week</p>
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

          return (
            <div
              key={day.iso}
              className={`qf-booking-preview-day ${
                isProposed ? "qf-booking-preview-day-proposed" : ""
              }`}
            >
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
                  <span className="qf-booking-preview-proposed-mark" aria-hidden="true" />
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
