"use client";

import {
  formatSuggestedDate,
  type ClashAnalysis,
} from "@/lib/calendar/clash-detection";
import { formatPlannedStartExact } from "@/lib/proposals/planned-start-date";

type BookingClashWarningsProps = {
  analysis: ClashAnalysis;
  acknowledged: boolean;
  onAcknowledgeChange: (value: boolean) => void;
  onUseSuggestedDate?: (iso: string) => void;
};

export function BookingClashWarnings({
  analysis,
  acknowledged,
  onAcknowledgeChange,
  onUseSuggestedDate,
}: BookingClashWarningsProps) {
  const uniqueMessages = Array.from(
    new Set(analysis.clashes.map((clash) => clash.message))
  );

  if (uniqueMessages.length === 0 && !analysis.suggestedStartDate) {
    return null;
  }

  return (
    <div className="qf-booking-clash-panel">
      {uniqueMessages.length > 0 ? (
        <div className="qf-booking-clash-list">
          {analysis.clashes.map((clash) => (
            <div
              key={`${clash.id}-${clash.severity}`}
              className={`qf-booking-clash-item qf-booking-clash-${clash.severity}`}
            >
              <p className="qf-booking-clash-message">{clash.message}</p>
              <p className="qf-booking-clash-job">
                {clash.jobTitle} · {clash.customer}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {analysis.suggestedStartDate && onUseSuggestedDate ? (
        <div className="qf-booking-clash-suggestion">
          <p className="qf-booking-clash-suggestion-text">
            Next available date without a confirmed clash:{" "}
            <strong>{formatSuggestedDate(analysis.suggestedStartDate)}</strong>
          </p>
          <button
            type="button"
            className="qf-booking-clash-suggestion-btn"
            onClick={() => onUseSuggestedDate(analysis.suggestedStartDate!)}
          >
            Use {formatPlannedStartExact(analysis.suggestedStartDate)}
          </button>
        </div>
      ) : null}

      {analysis.hasStrongOrWarning ? (
        <label className="qf-booking-clash-ack">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => onAcknowledgeChange(event.target.checked)}
          />
          <span>I understand — book this date anyway</span>
        </label>
      ) : null}
    </div>
  );
}
