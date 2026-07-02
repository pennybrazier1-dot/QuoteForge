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
}: {
  textValue: string;
  exactValue: string;
  onTextChange: (value: string) => void;
  onExactChange: (value: string) => void;
  textInputName?: string;
  exactInputName?: string;
}) {
  const [showExactDate, setShowExactDate] = useState(Boolean(exactValue));

  const handleExactChange = (isoDate: string) => {
    onExactChange(isoDate);

    if (isoDate) {
      const formatted = formatPlannedStartExact(isoDate);
      if (!textValue.trim() || textValue === formatPlannedStartExact(exactValue)) {
        onTextChange(formatted);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="plannedStartDateText" className="qf-field-label">
          Planned Start Date
        </label>
        <input
          id="plannedStartDateText"
          name={textInputName}
          type="text"
          value={textValue}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="e.g. week commencing 18 September, middle of August"
          className="form-input mt-2"
        />
        <p className="mt-2 text-xs text-muted">
          Use flexible wording from your site notes.
        </p>
      </div>

      {showExactDate ? (
        <div>
          <label htmlFor="plannedStartDateExact" className="qf-field-label">
            Exact Calendar Date
            <span className="ml-1 font-normal text-muted">(optional)</span>
          </label>
          <input
            id="plannedStartDateExact"
            name={exactInputName}
            type="date"
            value={exactValue}
            onChange={(event) => handleExactChange(event.target.value)}
            className="form-input form-input-date mt-2"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExactDate(true)}
          className="text-sm font-medium text-accent"
        >
          Add exact calendar date
        </button>
      )}
    </div>
  );
}
