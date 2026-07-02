"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildCalendarEvents,
  buildMonthCells,
  buildWeekDays,
  filterEventsForView,
  formatCalendarHeading,
  formatSelectedDayHeading,
  getEventCountsByDate,
  getEventsForDate,
  getWeekdayLabels,
  isSameIsoDate,
  isToday,
  parseIsoDate,
  shiftAnchor,
  shiftSelectedDate,
  toIsoDate,
  type CalendarEvent,
  type CalendarProposal,
  type CalendarView,
} from "@/lib/calendar/calendar-data";

const VIEW_OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "year", label: "Year" },
];

function CalendarEventCard({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={event.href}
      className={`qf-calendar-event qf-calendar-event-${event.tone}`}
    >
      <div className="qf-calendar-event-top">
        <p className="qf-calendar-event-title">{event.title}</p>
        <span className="qf-calendar-event-badge">
          {event.tone === "confirmed" ? "Confirmed" : "Provisional"}
        </span>
      </div>
      <p className="qf-calendar-event-customer">{event.customer}</p>
      {event.duration ? (
        <p className="qf-calendar-event-meta">{event.duration}</p>
      ) : null}
      {event.addressLine ? (
        <p className="qf-calendar-event-meta">{event.addressLine}</p>
      ) : null}
    </Link>
  );
}

function JobPlaceholderSlots() {
  return (
    <div className="qf-calendar-job-slots" aria-hidden="true">
      <div className="qf-calendar-job-slot qf-calendar-job-slot-confirmed">
        <span className="qf-calendar-job-slot-dot" />
        <span className="qf-calendar-job-slot-label">Confirmed booking</span>
      </div>
      <div className="qf-calendar-job-slot qf-calendar-job-slot-provisional">
        <span className="qf-calendar-job-slot-dot" />
        <span className="qf-calendar-job-slot-label">Provisional hold</span>
      </div>
    </div>
  );
}

function DayJobsPanel({
  dateIso,
  events,
  showHeading = true,
}: {
  dateIso: string;
  events: CalendarEvent[];
  showHeading?: boolean;
}) {
  const dayEvents = getEventsForDate(events, dateIso);

  return (
    <section className="qf-calendar-day-panel" aria-label="Jobs for selected day">
      {showHeading ? (
        <h2 className="qf-calendar-day-panel-title">
          {formatSelectedDayHeading(dateIso)}
        </h2>
      ) : null}

      {dayEvents.length > 0 ? (
        <div className="qf-calendar-group-list">
          {dayEvents.map((event) => (
            <CalendarEventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="qf-calendar-day-panel-empty">
          <p className="qf-calendar-empty-title">
            No jobs booked for this day yet.
          </p>
          <p className="qf-calendar-empty-body">
            When customers accept quotes, confirmed and provisional bookings
            will appear here.
          </p>
          <JobPlaceholderSlots />
        </div>
      )}
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
  eventCounts,
  onSelectDate,
}: {
  anchor: Date;
  selectedDate: string;
  todayIso: string;
  eventCounts: Map<string, { confirmed: number; provisional: number }>;
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
                counts={eventCounts.get(cell.iso)}
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
  eventCounts,
  onSelectDate,
}: {
  anchor: Date;
  selectedDate: string;
  todayIso: string;
  eventCounts: Map<string, { confirmed: number; provisional: number }>;
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
            counts={eventCounts.get(day.iso)}
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
  events,
  onSelectMonth,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onSelectMonth: (monthIndex: number) => void;
}) {
  const year = anchor.getFullYear();
  const months = Array.from({ length: 12 }, (_, index) => index);
  const today = new Date();
  const todayMonth = today.getFullYear() === year ? today.getMonth() : -1;

  return (
    <div className="qf-calendar-year">
      {months.map((monthIndex) => {
        const monthEvents = events.filter((event) => {
          const date = parseIsoDate(event.date);

          return date.getFullYear() === year && date.getMonth() === monthIndex;
        });
        const confirmed = monthEvents.filter(
          (event) => event.tone === "confirmed"
        ).length;
        const provisional = monthEvents.filter(
          (event) => event.tone === "provisional"
        ).length;

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
              {monthEvents.length === 0
                ? "No bookings yet"
                : `${monthEvents.length} booking${monthEvents.length === 1 ? "" : "s"}`}
            </p>
            {monthEvents.length > 0 ? (
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

  const allEvents = useMemo(
    () => buildCalendarEvents(proposals),
    [proposals]
  );
  const eventCounts = useMemo(
    () => getEventCountsByDate(allEvents),
    [allEvents]
  );
  const visibleEvents = useMemo(
    () => filterEventsForView(allEvents, view, anchor),
    [allEvents, view, anchor]
  );

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
          See your upcoming jobs at a glance. Tap a day to view details.
        </p>
      </header>

      <div className="qf-calendar-legend">
        <span className="qf-calendar-legend-item">
          <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
          Confirmed booking
        </span>
        <span className="qf-calendar-legend-item">
          <span className="qf-calendar-dot qf-calendar-dot-provisional" />
          Provisional booking
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
          eventCounts={eventCounts}
          onSelectDate={selectDate}
        />
      ) : null}

      {view === "week" ? (
        <WeekView
          anchor={anchor}
          selectedDate={selectedDate}
          todayIso={todayIso}
          eventCounts={eventCounts}
          onSelectDate={selectDate}
        />
      ) : null}

      {view === "day" ? (
        <DayView selectedDate={selectedDate} todayIso={todayIso} />
      ) : null}

      {view === "year" ? (
        <YearView
          anchor={anchor}
          events={visibleEvents}
          onSelectMonth={openMonthFromYear}
        />
      ) : null}

      {showDayPanel ? (
        <DayJobsPanel
          dateIso={selectedDate}
          events={allEvents}
          showHeading={view !== "day"}
        />
      ) : null}
    </div>
  );
}
