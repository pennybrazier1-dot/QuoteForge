"use client";

import { PlannedStartDateFields } from "@/components/proposals/planned-start-date-fields";
import { SectionCard } from "@/components/ui/section-card";
import {
  QUICK_QUOTE_CONFIRM_ITEMS,
  type QuickQuoteConfirmState,
} from "@/lib/proposals/quick-quote-preparation";
import {
  DURATION_UNITS,
  type DurationUnit,
} from "@/lib/proposals/proposal-form-helpers";

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="qf-qq-prep-head">
      <h2 className="qf-card-heading">{title}</h2>
    </div>
  );
}

function MoneyField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="qf-field-label">
        {label}
      </label>
      <div className="qf-price-input mt-2">
        <span className="qf-price-prefix" aria-hidden="true">
          £
        </span>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="form-input"
        />
      </div>
    </div>
  );
}

export function QuickQuotePreparation({
  jobDescription,
  onJobDescriptionChange,
  quoteNotes,
  onQuoteNotesChange,
  durationValue,
  onDurationValueChange,
  durationUnit,
  onDurationUnitChange,
  estimatedDuration,
  plannedStartDateText,
  onPlannedStartDateTextChange,
  plannedStartDateExact,
  onPlannedStartDateExactChange,
  confirmed,
  onConfirmedChange,
  materialsCost,
  onMaterialsCostChange,
  labourCost,
  onLabourCostChange,
  additionalCost,
  onAdditionalCostChange,
  totalCost,
  onTotalCostChange,
  onAddUpCosts,
  jobDescriptionMaxLength,
}: {
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  quoteNotes: string;
  onQuoteNotesChange: (value: string) => void;
  durationValue: string;
  onDurationValueChange: (value: string) => void;
  durationUnit: DurationUnit;
  onDurationUnitChange: (value: DurationUnit) => void;
  estimatedDuration: string;
  plannedStartDateText: string;
  onPlannedStartDateTextChange: (value: string) => void;
  plannedStartDateExact: string;
  onPlannedStartDateExactChange: (value: string) => void;
  confirmed: QuickQuoteConfirmState;
  onConfirmedChange: (next: QuickQuoteConfirmState) => void;
  materialsCost: string;
  onMaterialsCostChange: (value: string) => void;
  labourCost: string;
  onLabourCostChange: (value: string) => void;
  additionalCost: string;
  onAdditionalCostChange: (value: string) => void;
  totalCost: string;
  onTotalCostChange: (value: string) => void;
  onAddUpCosts: () => void;
  jobDescriptionMaxLength: number;
}) {
  return (
    <div className="qf-qq-prep">
      <SectionCard className="qf-card-form qf-qq-prep-card">
        <SectionHeading title="Quote details" />
        <p className="qf-body-text mt-2 text-muted">
          Capture the job in your own words, then add duration and any notes
          before generating the proposal.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor="jobDescription" className="qf-field-label">
              Job description
            </label>
            <p className="qf-body-text mt-1 text-muted">
              Write freely — materials, measurements, access, and what the
              customer wants.
            </p>
            <div className="qf-textarea-wrap mt-3">
              <textarea
                id="jobDescription"
                name="jobDescription"
                value={jobDescription}
                onChange={(event) =>
                  onJobDescriptionChange(
                    event.target.value.slice(0, jobDescriptionMaxLength)
                  )
                }
                rows={12}
                required
                maxLength={jobDescriptionMaxLength}
                placeholder="Replace bathroom suite, move pipes, customer wants grey tiles, measurements…"
                className="form-textarea qf-site-notes-textarea"
              />
              <p className="qf-char-count" aria-live="polite">
                {jobDescription.length.toLocaleString()} /{" "}
                {jobDescriptionMaxLength.toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="durationValue" className="qf-field-label">
              Estimated duration
            </label>
            <input
              type="hidden"
              name="estimatedDuration"
              value={estimatedDuration}
            />
            <div className="qf-duration-input mt-2">
              <input
                id="durationValue"
                type="text"
                value={durationValue}
                onChange={(event) =>
                  onDurationValueChange(event.target.value)
                }
                placeholder="e.g. 2"
                className="form-input"
              />
              <select
                aria-label="Duration unit"
                value={durationUnit}
                onChange={(event) =>
                  onDurationUnitChange(event.target.value as DurationUnit)
                }
                className="form-select"
              >
                {DURATION_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <PlannedStartDateFields
            textValue={plannedStartDateText}
            exactValue={plannedStartDateExact}
            onTextChange={onPlannedStartDateTextChange}
            onExactChange={onPlannedStartDateExactChange}
          />

          <div>
            <label htmlFor="quoteNotes" className="qf-field-label">
              Notes
            </label>
            <textarea
              id="quoteNotes"
              value={quoteNotes}
              onChange={(event) => onQuoteNotesChange(event.target.value)}
              rows={4}
              placeholder="Anything else to remember before quoting…"
              className="form-textarea mt-2"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form qf-qq-prep-card">
        <SectionHeading title="Things to confirm" />
        <p className="qf-body-text mt-2 text-muted">
          Tick what you have already covered. Unticked items stay on your list
          when you generate the proposal.
        </p>
        <ul className="qf-qq-confirm-list mt-4">
          {QUICK_QUOTE_CONFIRM_ITEMS.map((item) => (
            <li key={item.id}>
              <label className="qf-qq-confirm-item">
                <input
                  type="checkbox"
                  checked={Boolean(confirmed[item.id])}
                  onChange={(event) =>
                    onConfirmedChange({
                      ...confirmed,
                      [item.id]: event.target.checked,
                    })
                  }
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard className="qf-card-form qf-qq-prep-card">
        <SectionHeading title="Pricing" />
        <p className="qf-body-text mt-2 text-muted">
          Enter amounts yourself — Reanvil does not invent prices. Use Add up
          if you want the total from the three fields above.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <MoneyField
            id="materialsCost"
            label="Materials"
            value={materialsCost}
            onChange={onMaterialsCostChange}
            placeholder="e.g. 320"
          />
          <MoneyField
            id="labourCost"
            label="Labour"
            value={labourCost}
            onChange={onLabourCostChange}
            placeholder="e.g. 480"
          />
          <MoneyField
            id="additionalCost"
            label="Additional costs"
            value={additionalCost}
            onChange={onAdditionalCostChange}
            placeholder="e.g. 40"
          />
          <div>
            <MoneyField
              id="estimatedPrice"
              name="estimatedPrice"
              label="Total"
              value={totalCost}
              onChange={onTotalCostChange}
              placeholder="e.g. 840"
            />
            <button
              type="button"
              className="qf-btn-secondary qf-qq-add-up mt-3"
              onClick={onAddUpCosts}
            >
              Add up materials + labour + additional
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
