"use client";

import { useState } from "react";
import { formatPlannedStartExact } from "@/lib/proposals/planned-start-date";

export function PlannedStartDateFields({
  textValue,
  exactValue,
  onTextChange,
  onExactChange,
  textInputName = "plannedStartDateText",
  exactInputName = "plannedStartDateExact",
  calendarFirst = false,
}: {
  textValue: string;
  exactValue: string;
  onTextChange: (value: string) => void;
  onExactChange: (value: string) => void;
  textInputName?: string;
  exactInputName?: string;
  /** Prefer exact calendar date controls (revision/booking flow). */
  calendarFirst?: boolean;
}) {
  const [showExactDate, setShowExactDate] = useState(
    calendarFirst || Boolean(exactValue)
  );

  const handleExactChange = (isoDate: string) => {
    onExactChange(isoDate);

    if (isoDate) {
      const formatted = formatPlannedStartExact(isoDate);
      if (!textValue.trim() || textValue === formatPlannedStartExact(exactValue)) {
        onTextChange(formatted);
      }
    }
  };

  const exactField = showExactDate ? (
    <div>
      <label htmlFor="plannedStartDateExact" className="qf-field-label">
        Exact calendar date
      </label>
      <input
        id="plannedStartDateExact"
        name={exactInputName}
        type="date"
        value={exactValue}
        onChange={(event) => handleExactChange(event.target.value)}
        className="form-input form-input-date mt-2"
      />
      <p className="mt-2 text-xs text-muted">
        Used for calendar placement and availability.
      </p>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setShowExactDate(true)}
      className="text-sm font-medium text-accent"
    >
      Add exact calendar date
    </button>
  );

  const textField = (
    <div>
      <label htmlFor="plannedStartDateText" className="qf-field-label">
        {calendarFirst ? "Date label" : "Planned Start Date"}
      </label>
      <input
        id="plannedStartDateText"
        name={textInputName}
        type="text"
        value={textValue}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="e.g. 12 October 2026"
        className="form-input mt-2"
      />
      <p className="mt-2 text-xs text-muted">
        {calendarFirst
          ? "Flexible wording shown on the proposal. Pick the exact date above for the calendar."
          : "Use flexible wording from your site notes."}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {calendarFirst ? (
        <>
          {exactField}
          {textField}
        </>
      ) : (
        <>
          {textField}
          {exactField}
        </>
      )}
    </div>
  );
}
