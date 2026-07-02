"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildCalendarJobs,
  buildMonthCells,
  buildWeekDays,
  countJobsByTone,
  endOfWeek,
  formatCalendarHeading,
  formatSelectedDayHeading,
  getJobCountsByDate,
  getJobsForDate,
  getJobsForMonth,
  getWeekdayLabels,
  isSameIsoDate,
  isToday,
  parseIsoDate,
  shiftAnchor,
  shiftSelectedDate,
  startOfWeek,
  toIsoDate,
  type CalendarJob,
  type CalendarProposal,
  type CalendarView,
} from "@/lib/calendar/calendar-data";
import { formatSpanLabel } from "@/lib/calendar/job-span";

const VIEW_OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "year", label: "Year" },
];

function CalendarJobCard({
  job,
  dateIso,
}: {
  job: CalendarJob;
  dateIso?: string;
}) {
  const spanLabel = dateIso ? formatSpanLabel(job.spanDates, dateIso) : null;

  return (
    <Link
      href={job.href}
      className={`qf-calendar-event qf-calendar-event-${job.tone}`}
    >
      <div className="qf-calendar-event-top">
        <p className="qf-calendar-event-title">{job.title}</p>
        <span className="qf-calendar-event-badge">
          {job.tone === "confirmed" ? "Confirmed" : "Provisional"}
        </span>
      </div>
      <p className="qf-calendar-event-customer">{job.customer}</p>
      {spanLabel ? (
        <p className="qf-calendar-event-meta">{spanLabel}</p>
      ) : null}
      {job.duration ? (
        <p className="qf-calendar-event-meta">{job.duration}</p>
      ) : null}
      {job.addressLine ? (
        <p className="qf-calendar-event-meta">{job.addressLine}</p>
      ) : null}
    </Link>
  );
}

function DayJobsPanel({
  dateIso,
  jobs,
  showHeading = true,
}: {
  dateIso: string;
  jobs: CalendarJob[];
  showHeading?: boolean;
}) {
  const dayJobs = getJobsForDate(jobs, dateIso);

  return (
    <section className="qf-calendar-day-panel" aria-label="Jobs for selected day">
      {showHeading ? (
        <h2 className="qf-calendar-day-panel-title">
          {formatSelectedDayHeading(dateIso)}
          {isToday(dateIso) ? (
            <span className="qf-calendar-day-panel-today">Today</span>
          ) : null}
        </h2>
      ) : null}

      {dayJobs.length > 0 ? (
        <div className="qf-calendar-group-list">
          {dayJobs.map((job) => (
            <CalendarJobCard key={job.id} job={job} dateIso={dateIso} />
          ))}
        </div>
      ) : (
        <div className="qf-calendar-day-panel-empty">
          <p className="qf-calendar-empty-title">
            No jobs booked for this day yet.
          </p>
        </div>
      )}
    </section>
  );
}

function WeekJobsPanel({
  jobs,
  anchor,
}: {
  jobs: CalendarJob[];
  anchor: Date;
}) {
  const weekStart = startOfWeek(anchor);
  const weekEnd = endOfWeek(anchor);
  const weekJobs = jobs.filter((job) =>
    job.spanDates.some((date) => date >= weekStart && date <= weekEnd)
  );

  if (weekJobs.length === 0) {
    return null;
  }

  return (
    <section className="qf-calendar-week-jobs" aria-label="Jobs this week">
      <h2 className="qf-calendar-week-jobs-title">This week</h2>
      <div className="qf-calendar-group-list">
        {weekJobs.map((job) => (
          <CalendarJobCard key={job.id} job={job} dateIso={job.startDate} />
        ))}
      </div>
    </section>
  );
}

function DayButton({
  iso,
  dayNumber,
  weekdayShort,
  compact = false,
  selected,
  today,
  counts,
  onSelect,
}: {
  iso: string;
  dayNumber: number;
  weekdayShort?: string;
  compact?: boolean;
  selected: boolean;
  today: boolean;
  counts?: { confirmed: number; provisional: number };
  onSelect: (iso: string) => void;
}) {
  const className = [
    "qf-calendar-day-btn",
    compact ? "qf-calendar-day-btn-compact" : "",
    selected ? "qf-calendar-day-btn-selected" : "",
    today ? "qf-calendar-day-btn-today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(iso)}
      aria-label={formatSelectedDayHeading(iso)}
      aria-pressed={selected}
    >
      {weekdayShort ? (
        <span className="qf-calendar-day-btn-weekday">{weekdayShort}</span>
      ) : null}
      <span className="qf-calendar-day-btn-number">{dayNumber}</span>
      {counts && (counts.confirmed > 0 || counts.provisional > 0) ? (
        <span className="qf-calendar-day-btn-dots">
          {counts.confirmed > 0 ? (
            <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
          ) : null}
          {counts.provisional > 0 ? (
            <span className="qf-calendar-dot qf-calendar-dot-provisional" />
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function MonthView({
  anchor,
  selectedDate,
  todayIso,
  jobCounts,
  onSelectDate,
}: {
  anchor: Date;
  selectedDate: string;
  todayIso: string;
  jobCounts: Map<string, { confirmed: number; provisional: number }>;
  onSelectDate: (iso: string) => void;
}) {
  const cells = useMemo(() => buildMonthCells(anchor), [anchor]);

  return (
    <div className="qf-calendar-month">
      <div className="qf-calendar-month-head">
        {getWeekdayLabels().map((label) => (
          <span key={label} className="qf-calendar-month-label">
            {label}
          </span>
        ))}
      </div>
      <div className="qf-calendar-month-grid">
        {cells.map((cell, index) => {
          if (!cell.day || !cell.iso) {
            return (
              <div
                key={`empty-${index}`}
                className="qf-calendar-month-cell qf-calendar-month-cell-empty"
                aria-hidden="true"
              />
            );
          }

          return (
            <div key={cell.iso} className="qf-calendar-month-cell">
              <DayButton
                iso={cell.iso}
                dayNumber={cell.day}
                selected={isSameIsoDate(cell.iso, selectedDate)}
                today={isToday(cell.iso, todayIso)}
                counts={jobCounts.get(cell.iso)}
                onSelect={onSelectDate}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  anchor,
  selectedDate,
  todayIso,
  jobCounts,
  onSelectDate,
}: {
  anchor: Date;
  selectedDate: string;
  todayIso: string;
  jobCounts: Map<string, { confirmed: number; provisional: number }>;
  onSelectDate: (iso: string) => void;
}) {
  const weekDays = useMemo(() => buildWeekDays(anchor), [anchor]);

  return (
    <div className="qf-calendar-week">
      <div className="qf-calendar-week-strip">
        {weekDays.map((day) => (
          <DayButton
            key={day.iso}
            iso={day.iso}
            dayNumber={day.dayNumber}
            weekdayShort={day.weekdayShort}
            compact
            selected={isSameIsoDate(day.iso, selectedDate)}
            today={isToday(day.iso, todayIso)}
            counts={jobCounts.get(day.iso)}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}

function DayView({
  selectedDate,
  todayIso,
}: {
  selectedDate: string;
  todayIso: string;
}) {
  return (
    <div className="qf-calendar-day-focus">
      <div
        className={`qf-calendar-day-focus-card ${
          isToday(selectedDate, todayIso) ? "qf-calendar-day-focus-card-today" : ""
        }`}
      >
        <p className="qf-calendar-day-focus-label">
          {isToday(selectedDate, todayIso) ? "Today" : "Selected day"}
        </p>
        <p className="qf-calendar-day-focus-date">
          {formatSelectedDayHeading(selectedDate)}
        </p>
      </div>
    </div>
  );
}

function YearView({
  anchor,
  jobs,
  onSelectMonth,
}: {
  anchor: Date;
  jobs: CalendarJob[];
  onSelectMonth: (monthIndex: number) => void;
}) {
  const year = anchor.getFullYear();
  const months = Array.from({ length: 12 }, (_, index) => index);
  const today = new Date();
  const todayMonth = today.getFullYear() === year ? today.getMonth() : -1;

  return (
    <div className="qf-calendar-year">
      {months.map((monthIndex) => {
        const monthJobs = getJobsForMonth(jobs, year, monthIndex);
        const { confirmed, provisional } = countJobsByTone(monthJobs);

        return (
          <button
            key={monthIndex}
            type="button"
            className={`qf-calendar-year-month ${
              monthIndex === todayMonth ? "qf-calendar-year-month-today" : ""
            }`}
            onClick={() => onSelectMonth(monthIndex)}
          >
            <h3 className="qf-calendar-year-month-title">
              {new Intl.DateTimeFormat("en-GB", { month: "long" }).format(
                new Date(year, monthIndex, 1)
              )}
            </h3>
            <p className="qf-calendar-year-month-count">
              {monthJobs.length === 0
                ? "No bookings"
                : `${monthJobs.length} job${monthJobs.length === 1 ? "" : "s"}`}
            </p>
            {monthJobs.length > 0 ? (
              <div className="qf-calendar-year-month-dots">
                {confirmed > 0 ? (
                  <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
                ) : null}
                {provisional > 0 ? (
                  <span className="qf-calendar-dot qf-calendar-dot-provisional" />
                ) : null}
              </div>
            ) : (
              <p className="qf-calendar-year-month-placeholder">
                Tap to open month
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CalendarScreen({
  proposals,
}: {
  proposals: CalendarProposal[];
}) {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const allJobs = useMemo(() => buildCalendarJobs(proposals), [proposals]);
  const jobCounts = useMemo(() => getJobCountsByDate(allJobs), [allJobs]);

  const selectDate = (iso: string) => {
    setSelectedDate(iso);
    setAnchor(parseIsoDate(iso));
  };

  const goToToday = () => {
    const now = new Date();
    setAnchor(now);
    setSelectedDate(todayIso);
  };

  const goToPrevious = () => {
    if (view === "day") {
      const nextDate = shiftSelectedDate(selectedDate, -1);
      setSelectedDate(nextDate);
      setAnchor(parseIsoDate(nextDate));
      return;
    }

    setAnchor((current) => shiftAnchor(view, current, -1));
  };

  const goToNext = () => {
    if (view === "day") {
      const nextDate = shiftSelectedDate(selectedDate, 1);
      setSelectedDate(nextDate);
      setAnchor(parseIsoDate(nextDate));
      return;
    }

    setAnchor((current) => shiftAnchor(view, current, 1));
  };

  const openMonthFromYear = (monthIndex: number) => {
    const next = new Date(anchor.getFullYear(), monthIndex, 1);
    const iso = toIsoDate(next);

    setView("month");
    setAnchor(next);

    if (isToday(iso, todayIso)) {
      setSelectedDate(todayIso);
      return;
    }

    setSelectedDate(iso);
  };

  const showDayPanel = view === "month" || view === "week" || view === "day";

  return (
    <div className="qf-calendar-page qf-mobile-safe">
      <header className="qf-page-simple-header">
        <h1 className="qf-page-simple-title">Calendar</h1>
        <p className="qf-page-simple-subtitle">
          Sent quotes with a planned start date. Amber holds the date while you
          wait; green is a confirmed booking.
        </p>
      </header>

      <div className="qf-calendar-legend">
        <span className="qf-calendar-legend-item">
          <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
          Confirmed booking
        </span>
        <span className="qf-calendar-legend-item">
          <span className="qf-calendar-dot qf-calendar-dot-provisional" />
          Holding date (awaiting confirmation)
        </span>
      </div>

      <div className="qf-calendar-toolbar">
        <div
          className="qf-calendar-view-tabs"
          role="tablist"
          aria-label="Calendar view"
        >
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={view === option.value}
              className={`qf-calendar-view-tab qf-touch-target ${
                view === option.value ? "qf-calendar-view-tab-active" : ""
              }`}
              onClick={() => setView(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="qf-calendar-nav">
          <button
            type="button"
            className="qf-calendar-nav-btn qf-touch-target"
            onClick={goToPrevious}
            aria-label="Previous period"
          >
            ‹
          </button>
          <p className="qf-calendar-nav-label">
            {view === "day"
              ? formatSelectedDayHeading(selectedDate)
              : formatCalendarHeading(view, anchor)}
          </p>
          <button
            type="button"
            className="qf-calendar-nav-btn qf-touch-target"
            onClick={goToNext}
            aria-label="Next period"
          >
            ›
          </button>
        </div>

        <button
          type="button"
          className="qf-calendar-today-btn qf-touch-target"
          onClick={goToToday}
        >
          Today
        </button>
      </div>

      {view === "month" ? (
        <MonthView
          anchor={anchor}
          selectedDate={selectedDate}
          todayIso={todayIso}
          jobCounts={jobCounts}
          onSelectDate={selectDate}
        />
      ) : null}

      {view === "week" ? (
        <>
          <WeekView
            anchor={anchor}
            selectedDate={selectedDate}
            todayIso={todayIso}
            jobCounts={jobCounts}
            onSelectDate={selectDate}
          />
          <WeekJobsPanel jobs={allJobs} anchor={anchor} />
        </>
      ) : null}

      {view === "day" ? (
        <DayView selectedDate={selectedDate} todayIso={todayIso} />
      ) : null}

      {view === "year" ? (
        <YearView
          anchor={anchor}
          jobs={allJobs}
          onSelectMonth={openMonthFromYear}
        />
      ) : null}

      {showDayPanel ? (
        <DayJobsPanel
          dateIso={selectedDate}
          jobs={allJobs}
          showHeading={view !== "day"}
        />
      ) : null}
    </div>
  );
}
