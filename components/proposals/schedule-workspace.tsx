"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookingClashWarnings } from "@/components/proposals/booking-clash-warnings";
import { AuthError } from "@/components/auth/auth-shell";
import { analyzeBookingClashes } from "@/lib/calendar/clash-detection";
import {
  buildCalendarJobs,
  buildMonthCells,
  buildWeekDays,
  formatCalendarHeading,
  formatSelectedDayHeading,
  getJobCountsByDate,
  getJobsForDate,
  getWeekdayLabels,
  isSameIsoDate,
  isToday,
  parseIsoDate,
  shiftAnchor,
  toIsoDate,
  type CalendarJob,
  type CalendarProposal,
} from "@/lib/calendar/calendar-data";
import { formatSpanLabel } from "@/lib/calendar/job-span";
import { mergeCalendarJobs } from "@/lib/calendar/local-calendar-data";
import { useServerSiteVisitJobs } from "@/lib/calendar/use-server-site-visit-jobs";
import {
  BOOKING_CONFIRMATIONS,
  formatBookingConfirmation,
  type BookingConfirmation,
} from "@/lib/proposals/booking";
import {
  formatPlannedStartExact,
  normalizePlannedStartExact,
} from "@/lib/proposals/planned-start-date";
import {
  confirmSchedule,
  type ConfirmScheduleState,
} from "@/lib/proposals/schedule/confirm-schedule-action";
import {
  buildScheduleDateLabel,
  formatPlannedStartTimeLabel,
  normalizePlannedStartTime,
} from "@/lib/proposals/schedule/schedule-fields";

type ScheduleView = "month" | "week";

const START_TIME_OPTIONS = [
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
] as const;

const confirmInitialState: ConfirmScheduleState = {};

export type ScheduleWorkspaceProposal = {
  id: string;
  proposalNumber: string;
  title: string;
  customerName: string | null;
  estimatedDuration: string | null;
  plannedStartDate: string | null;
  plannedStartDateText: string | null;
  plannedStartTime: string | null;
  bookingConfirmation: BookingConfirmation | null;
};

function ConfirmButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="qf-btn-primary qf-schedule-confirm-btn"
    >
      {pending ? "Saving schedule…" : label}
    </button>
  );
}

function ExistingJobCard({
  job,
  dateIso,
}: {
  job: CalendarJob;
  dateIso: string;
}) {
  const spanLabel = formatSpanLabel(job.spanDates, dateIso);

  return (
    <div
      className={`qf-calendar-event qf-calendar-event-${job.tone} qf-schedule-event-readonly`}
      aria-readonly="true"
    >
      <div className="qf-calendar-event-top">
        <p className="qf-calendar-event-title">{job.title}</p>
        <span className="qf-calendar-event-badge">
          {job.tone === "confirmed"
            ? "Confirmed"
            : job.tone === "site_visit"
              ? "Site visit"
              : "Provisional"}
        </span>
      </div>
      <p className="qf-calendar-event-customer">{job.customer}</p>
      {spanLabel ? (
        <p className="qf-calendar-event-meta">{spanLabel}</p>
      ) : null}
      {job.duration ? (
        <p className="qf-calendar-event-meta">{job.duration}</p>
      ) : null}
    </div>
  );
}

export function ScheduleWorkspace({
  proposal,
  calendarProposals,
  suggestedDateText = null,
  suggestedDateExact = null,
}: {
  proposal: ScheduleWorkspaceProposal;
  calendarProposals: CalendarProposal[];
  suggestedDateText?: string | null;
  suggestedDateExact?: string | null;
}) {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const initialExact =
    normalizePlannedStartExact(suggestedDateExact) ??
    normalizePlannedStartExact(proposal.plannedStartDate) ??
    null;
  const initialTime =
    normalizePlannedStartTime(proposal.plannedStartTime) ?? "09:00";

  const [view, setView] = useState<ScheduleView>("month");
  const [anchor, setAnchor] = useState(() =>
    initialExact ? parseIsoDate(initialExact) : new Date()
  );
  const [draftDate, setDraftDate] = useState<string | null>(initialExact);
  const [draftTime, setDraftTime] = useState(initialTime);
  const [duration, setDuration] = useState(proposal.estimatedDuration ?? "");
  const [bookingStatus, setBookingStatus] = useState<BookingConfirmation>(
    proposal.bookingConfirmation ?? "provisional"
  );
  const [acknowledgedClash, setAcknowledgedClash] = useState(false);
  const [confirmState, confirmAction] = useActionState(
    confirmSchedule,
    confirmInitialState
  );

  const siteVisitJobs = useServerSiteVisitJobs();
  const existingJobs = useMemo(() => {
    const built = mergeCalendarJobs(
      buildCalendarJobs(calendarProposals),
      siteVisitJobs
    );
    // Current proposal is shown only as the local draft (blue), never as a
    // committed calendar event until Confirm.
    return built.filter((job) => job.proposalId !== proposal.id);
  }, [calendarProposals, siteVisitJobs, proposal.id]);

  const jobCounts = useMemo(() => getJobCountsByDate(existingJobs), [existingJobs]);
  const dayJobs = useMemo(
    () => (draftDate ? getJobsForDate(existingJobs, draftDate) : []),
    [existingJobs, draftDate]
  );

  const draftSpanDates = useMemo(() => {
    if (!draftDate) {
      return [] as string[];
    }
    return analyzeBookingClashes(
      {
        proposalId: proposal.id,
        startDateIso: draftDate,
        duration,
        bookingStatus,
      },
      existingJobs
    ).proposedSpanDates;
  }, [draftDate, duration, bookingStatus, proposal.id, existingJobs]);

  const clashAnalysis = useMemo(
    () =>
      analyzeBookingClashes(
        {
          proposalId: proposal.id,
          startDateIso: draftDate,
          duration,
          bookingStatus,
        },
        existingJobs
      ),
    [proposal.id, draftDate, duration, bookingStatus, existingJobs]
  );

  const needsAcknowledgment = clashAnalysis.hasStrongOrWarning;
  const canConfirm =
    Boolean(draftDate && draftTime && duration.trim()) &&
    (!needsAcknowledgment || acknowledgedClash);

  const suggestedLabel =
    suggestedDateText?.trim() ||
    (suggestedDateExact
      ? formatPlannedStartExact(suggestedDateExact)
      : null) ||
    proposal.plannedStartDateText?.trim() ||
    null;

  const selectDate = (iso: string) => {
    setDraftDate(iso);
    setAnchor(parseIsoDate(iso));
    setAcknowledgedClash(false);
  };

  const monthCells = useMemo(() => buildMonthCells(anchor), [anchor]);
  const weekDays = useMemo(() => buildWeekDays(anchor), [anchor]);

  const draftDateLabel = draftDate
    ? buildScheduleDateLabel({
        dateIso: draftDate,
        time: draftTime,
      })
    : "Not selected yet";

  return (
    <div className="qf-schedule-page qf-workspace-page qf-mobile-safe">
      <header className="qf-revision-header">
        <div className="qf-revision-header-top">
          <p className="qf-workspace-number">{proposal.proposalNumber}</p>
          <Link href={`/proposals/${proposal.id}`} className="qf-btn-secondary">
            Back to proposal
          </Link>
        </div>
        <h1 className="qf-revision-title">Schedule job</h1>
        <p className="qf-revision-intro">
          Pick a date on the calendar. Nothing is saved until you confirm.
        </p>
      </header>

      <div className="qf-schedule-layout">
        <section className="qf-schedule-calendar" aria-label="Calendar">
          <div className="qf-calendar-legend">
            <span className="qf-calendar-legend-item">
              <span className="qf-calendar-dot qf-calendar-dot-provisional" />
              Provisional
            </span>
            <span className="qf-calendar-legend-item">
              <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
              Confirmed
            </span>
            <span className="qf-calendar-legend-item">
              <span className="qf-calendar-dot qf-calendar-dot-draft" />
              This job (draft)
            </span>
          </div>

          <div className="qf-calendar-toolbar">
            <div
              className="qf-calendar-view-tabs qf-schedule-view-tabs"
              role="tablist"
              aria-label="Calendar view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "month"}
                className={`qf-calendar-view-tab qf-touch-target ${
                  view === "month" ? "qf-calendar-view-tab-active" : ""
                }`}
                onClick={() => setView("month")}
              >
                Month
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "week"}
                className={`qf-calendar-view-tab qf-touch-target ${
                  view === "week" ? "qf-calendar-view-tab-active" : ""
                }`}
                onClick={() => setView("week")}
              >
                Week
              </button>
            </div>

            <div className="qf-calendar-nav">
              <button
                type="button"
                className="qf-calendar-nav-btn qf-touch-target"
                onClick={() => setAnchor((current) => shiftAnchor(view, current, -1))}
                aria-label="Previous period"
              >
                ‹
              </button>
              <p className="qf-calendar-nav-label">
                {formatCalendarHeading(view, anchor)}
              </p>
              <button
                type="button"
                className="qf-calendar-nav-btn qf-touch-target"
                onClick={() => setAnchor((current) => shiftAnchor(view, current, 1))}
                aria-label="Next period"
              >
                ›
              </button>
            </div>

            <button
              type="button"
              className="qf-calendar-today-btn qf-touch-target"
              onClick={() => {
                const now = new Date();
                setAnchor(now);
                setDraftDate(todayIso);
                setAcknowledgedClash(false);
              }}
            >
              Today
            </button>
          </div>

          {view === "month" ? (
            <div className="qf-calendar-month">
              <div className="qf-calendar-month-head">
                {getWeekdayLabels().map((label) => (
                  <span key={label} className="qf-calendar-month-label">
                    {label}
                  </span>
                ))}
              </div>
              <div className="qf-calendar-month-grid">
                {monthCells.map((cell, index) => {
                  if (!cell.day || !cell.iso) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="qf-calendar-month-cell qf-calendar-month-cell-empty"
                        aria-hidden="true"
                      />
                    );
                  }

                  const counts = jobCounts.get(cell.iso);
                  const isDraft = draftSpanDates.includes(cell.iso);
                  const isSelected = draftDate
                    ? isSameIsoDate(cell.iso, draftDate)
                    : false;

                  return (
                    <div key={cell.iso} className="qf-calendar-month-cell">
                      <button
                        type="button"
                        className={[
                          "qf-calendar-day-btn",
                          isSelected ? "qf-calendar-day-btn-selected" : "",
                          isToday(cell.iso, todayIso)
                            ? "qf-calendar-day-btn-today"
                            : "",
                          isDraft ? "qf-calendar-day-btn-draft" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => selectDate(cell.iso!)}
                        aria-label={formatSelectedDayHeading(cell.iso)}
                        aria-pressed={isSelected}
                      >
                        <span className="qf-calendar-day-btn-number">
                          {cell.day}
                        </span>
                        {counts &&
                        (counts.confirmed > 0 ||
                          counts.provisional > 0 ||
                          counts.siteVisit > 0) ? (
                          <span className="qf-calendar-day-btn-dots">
                            {counts.confirmed > 0 ? (
                              <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
                            ) : null}
                            {counts.provisional > 0 ? (
                              <span className="qf-calendar-dot qf-calendar-dot-provisional" />
                            ) : null}
                            {counts.siteVisit > 0 ? (
                              <span className="qf-calendar-dot qf-calendar-dot-site-visit" />
                            ) : null}
                          </span>
                        ) : null}
                        {isDraft ? (
                          <span className="qf-calendar-day-btn-dots">
                            <span className="qf-calendar-dot qf-calendar-dot-draft" />
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="qf-calendar-week">
              <div className="qf-calendar-week-strip">
                {weekDays.map((day) => {
                  const counts = jobCounts.get(day.iso);
                  const isDraft = draftSpanDates.includes(day.iso);
                  const isSelected = draftDate
                    ? isSameIsoDate(day.iso, draftDate)
                    : false;

                  return (
                    <button
                      key={day.iso}
                      type="button"
                      className={[
                        "qf-calendar-day-btn",
                        "qf-calendar-day-btn-compact",
                        isSelected ? "qf-calendar-day-btn-selected" : "",
                        isToday(day.iso, todayIso)
                          ? "qf-calendar-day-btn-today"
                          : "",
                        isDraft ? "qf-calendar-day-btn-draft" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => selectDate(day.iso)}
                      aria-label={formatSelectedDayHeading(day.iso)}
                      aria-pressed={isSelected}
                    >
                      <span className="qf-calendar-day-btn-weekday">
                        {day.weekdayShort}
                      </span>
                      <span className="qf-calendar-day-btn-number">
                        {day.dayNumber}
                      </span>
                      {counts &&
                      (counts.confirmed > 0 ||
                        counts.provisional > 0 ||
                        counts.siteVisit > 0) ? (
                        <span className="qf-calendar-day-btn-dots">
                          {counts.confirmed > 0 ? (
                            <span className="qf-calendar-dot qf-calendar-dot-confirmed" />
                          ) : null}
                          {counts.provisional > 0 ? (
                            <span className="qf-calendar-dot qf-calendar-dot-provisional" />
                          ) : null}
                          {counts.siteVisit > 0 ? (
                            <span className="qf-calendar-dot qf-calendar-dot-site-visit" />
                          ) : null}
                        </span>
                      ) : null}
                      {isDraft ? (
                        <span className="qf-calendar-day-btn-dots">
                          <span className="qf-calendar-dot qf-calendar-dot-draft" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <section
            className="qf-calendar-day-panel"
            aria-label="Events on selected day"
          >
            <h2 className="qf-calendar-day-panel-title">
              {draftDate
                ? formatSelectedDayHeading(draftDate)
                : "Select a date"}
            </h2>

            {draftDate ? (
              <div
                className="qf-calendar-event qf-calendar-event-draft"
                aria-label="Current job draft"
              >
                <div className="qf-calendar-event-top">
                  <p className="qf-calendar-event-title">{proposal.title}</p>
                  <span className="qf-calendar-event-badge">Draft</span>
                </div>
                <p className="qf-calendar-event-customer">
                  {proposal.customerName ?? "Customer"}
                </p>
                <p className="qf-calendar-event-meta">
                  {draftDateLabel}
                  {duration.trim() ? ` · ${duration.trim()}` : ""}
                </p>
                <p className="qf-calendar-event-meta">
                  Draft only — not booked yet
                </p>
              </div>
            ) : null}

            {dayJobs.length > 0 ? (
              <div className="qf-calendar-group-list">
                {dayJobs.map((job) => (
                  <ExistingJobCard
                    key={job.id}
                    job={job}
                    dateIso={draftDate!}
                  />
                ))}
              </div>
            ) : draftDate ? (
              <p className="qf-schedule-empty-day">
                No other jobs on this day.
              </p>
            ) : (
              <p className="qf-schedule-empty-day">
                Click a date to place a temporary draft.
              </p>
            )}
          </section>
        </section>

        <aside className="qf-schedule-panel" aria-label="Current job">
          <div className="qf-schedule-panel-card">
            <h2 className="qf-schedule-panel-title">Current job</h2>
            <dl className="qf-schedule-facts">
              <div>
                <dt>Customer</dt>
                <dd>{proposal.customerName?.trim() || "Customer"}</dd>
              </div>
              <div>
                <dt>Proposal / job</dt>
                <dd>
                  {proposal.proposalNumber}
                  {proposal.title ? ` · ${proposal.title}` : ""}
                </dd>
              </div>
              {suggestedLabel ? (
                <div>
                  <dt>Suggested date</dt>
                  <dd>{suggestedLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt>Estimated duration</dt>
                <dd>{duration.trim() || "Not set yet"}</dd>
              </div>
            </dl>
            <p className="qf-schedule-note">
              Nothing is booked until you confirm
            </p>
          </div>

          <form action={confirmAction} className="qf-schedule-panel-card">
            <h2 className="qf-schedule-panel-title">Selection</h2>

            <input type="hidden" name="proposalId" value={proposal.id} />
            <input
              type="hidden"
              name="plannedStartDateExact"
              value={draftDate ?? ""}
            />
            <input
              type="hidden"
              name="plannedStartDateText"
              value={
                draftDate
                  ? buildScheduleDateLabel({
                      dateIso: draftDate,
                      time: draftTime,
                    })
                  : ""
              }
            />
            <input type="hidden" name="plannedStartTime" value={draftTime} />
            <input type="hidden" name="estimatedDuration" value={duration} />
            <input
              type="hidden"
              name="bookingConfirmation"
              value={bookingStatus}
            />

            <label className="qf-schedule-field">
              <span>Date</span>
              <input
                type="text"
                readOnly
                value={
                  draftDate
                    ? formatPlannedStartExact(draftDate)
                    : "Click a date on the calendar"
                }
                className="qf-input"
              />
            </label>

            <label className="qf-schedule-field">
              <span>Start time</span>
              <select
                className="qf-input"
                value={draftTime}
                onChange={(event) => {
                  setDraftTime(event.target.value);
                  setAcknowledgedClash(false);
                }}
              >
                {START_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {formatPlannedStartTimeLabel(time)}
                  </option>
                ))}
              </select>
            </label>

            <label className="qf-schedule-field">
              <span>Duration</span>
              <input
                type="text"
                className="qf-input"
                value={duration}
                onChange={(event) => {
                  setDuration(event.target.value);
                  setAcknowledgedClash(false);
                }}
                placeholder="e.g. 2 days"
              />
            </label>

            <fieldset className="qf-schedule-status">
              <legend>Booking status</legend>
              <div className="qf-schedule-status-options">
                {BOOKING_CONFIRMATIONS.map((status) => (
                  <label key={status} className="qf-schedule-status-option">
                    <input
                      type="radio"
                      name="bookingStatusUi"
                      checked={bookingStatus === status}
                      onChange={() => {
                        setBookingStatus(status);
                        setAcknowledgedClash(false);
                      }}
                    />
                    <span>{formatBookingConfirmation(status)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <BookingClashWarnings
              analysis={clashAnalysis}
              acknowledged={acknowledgedClash}
              onAcknowledgeChange={setAcknowledgedClash}
              onUseSuggestedDate={(iso) => selectDate(iso)}
            />

            {confirmState.error ? (
              <AuthError message={confirmState.error} />
            ) : null}

            <ConfirmButton
              disabled={!canConfirm}
              label={
                bookingStatus === "confirmed"
                  ? "Confirm schedule"
                  : "Hold date (provisional)"
              }
            />
          </form>
        </aside>
      </div>
    </div>
  );
}
