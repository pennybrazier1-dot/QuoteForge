"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildCalendarEvents,
  filterEventsForView,
  formatCalendarHeading,
  groupEventsByDate,
  shiftAnchor,
  type CalendarEvent,
  type CalendarProposal,
  type CalendarView,
} from "@/lib/calendar/calendar-data";

const VIEW_OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
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

function DayWeekList({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return <p className="qf-calendar-empty">No bookings in this period.</p>;
  }

  const groups = groupEventsByDate(events);

  return (
    <div className="qf-calendar-groups">
      {[...groups.entries()].map(([date, dayEvents]) => (
        <section key={date} className="qf-calendar-group">
          <h3 className="qf-calendar-group-title">
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date(date))}
          </h3>
          <div className="qf-calendar-group-list">
            {dayEvents.map((event) => (
              <CalendarEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MonthGrid({
  events,
  anchor,
}: {
  events: CalendarEvent[];
  anchor: Date;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventCounts = useMemo(() => {
    const counts = new Map<string, { confirmed: number; provisional: number }>();

    for (const event of events) {
      const current = counts.get(event.date) ?? {
        confirmed: 0,
        provisional: 0,
      };
      current[event.tone] += 1;
      counts.set(event.date, current);
    }

    return counts;
  }, [events]);

  const cells: Array<{ day: number | null; iso: string | null }> = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ day: null, iso: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = new Date(year, month, day).toISOString().slice(0, 10);
    cells.push({ day, iso });
  }

  return (
    <div className="qf-calendar-month">
      <div className="qf-calendar-month-head">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label} className="qf-calendar-month-label">
            {label}
          </span>
        ))}
      </div>
      <div className="qf-calendar-month-grid">
        {cells.map((cell, index) => {
          if (!cell.day || !cell.iso) {
            return <div key={`empty-${index}`} className="qf-calendar-month-cell qf-calendar-month-cell-empty" />;
          }

          const counts = eventCounts.get(cell.iso);

          return (
            <div key={cell.iso} className="qf-calendar-month-cell">
              <span className="qf-calendar-month-day">{cell.day}</span>
              {counts ? (
                <div className="qf-calendar-month-dots">
                  {counts.confirmed > 0 ? (
                    <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
                  ) : null}
                  {counts.provisional > 0 ? (
                    <span className="qf-calendar-dot qf-calendar-dot-provisional" />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <DayWeekList events={events} />
    </div>
  );
}

function YearOverview({
  events,
  anchor,
}: {
  events: CalendarEvent[];
  anchor: Date;
}) {
  const year = anchor.getFullYear();
  const months = Array.from({ length: 12 }, (_, index) => index);

  return (
    <div className="qf-calendar-year">
      {months.map((monthIndex) => {
        const monthEvents = events.filter((event) => {
          const date = new Date(event.date);
          return date.getFullYear() === year && date.getMonth() === monthIndex;
        });

        return (
          <section key={monthIndex} className="qf-calendar-year-month">
            <h3 className="qf-calendar-year-month-title">
              {new Intl.DateTimeFormat("en-GB", { month: "long" }).format(
                new Date(year, monthIndex, 1)
              )}
            </h3>
            <p className="qf-calendar-year-month-count">
              {monthEvents.length} booking{monthEvents.length === 1 ? "" : "s"}
            </p>
          </section>
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
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const allEvents = useMemo(
    () => buildCalendarEvents(proposals),
    [proposals]
  );
  const visibleEvents = useMemo(
    () => filterEventsForView(allEvents, view, anchor),
    [allEvents, view, anchor]
  );

  return (
    <div className="qf-calendar-page">
      <header className="qf-page-simple-header">
        <h1 className="qf-page-simple-title">Calendar</h1>
        <p className="qf-page-simple-subtitle">
          Green bookings are confirmed. Amber bookings are provisional while you
          wait for confirmation.
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
        <div className="qf-calendar-view-tabs" role="tablist" aria-label="Calendar view">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={view === option.value}
              className={`qf-calendar-view-tab ${
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
            className="qf-calendar-nav-btn"
            onClick={() => setAnchor((current) => shiftAnchor(view, current, -1))}
            aria-label="Previous period"
          >
            ‹
          </button>
          <p className="qf-calendar-nav-label">{formatCalendarHeading(view, anchor)}</p>
          <button
            type="button"
            className="qf-calendar-nav-btn"
            onClick={() => setAnchor((current) => shiftAnchor(view, current, 1))}
            aria-label="Next period"
          >
            ›
          </button>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid events={visibleEvents} anchor={anchor} />
      ) : view === "year" ? (
        <YearOverview events={visibleEvents} anchor={anchor} />
      ) : (
        <DayWeekList events={visibleEvents} />
      )}
    </div>
  );
}
