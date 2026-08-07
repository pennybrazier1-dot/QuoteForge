"use client";

import { useId, useMemo, useRef, useState } from "react";
import { PlannedStartDateFields } from "@/components/proposals/planned-start-date-fields";
import { SectionCard } from "@/components/ui/section-card";
import {
  groupIncompleteReadinessByCategory,
  getIncompleteQuoteReadinessItems,
} from "@/lib/proposals/quote-readiness";
import { type QuickQuotePrepNotes } from "@/lib/proposals/quick-quote-preparation";
import {
  DURATION_UNITS,
  type DurationUnit,
} from "@/lib/proposals/proposal-form-helpers";

function SectionHeading({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="qf-qq-prep-head">
      <div>
        <h2 className="qf-card-heading">{title}</h2>
        {hint ? <p className="qf-body-text mt-1 text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function NoteField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="qf-field-label">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="form-textarea mt-2"
      />
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
  helper,
}: {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
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
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
    </div>
  );
}

export type QuickQuoteLocalPhoto = {
  id: string;
  name: string;
  previewUrl: string;
};

function hasOptionalDetailContent(options: {
  prepNotes: QuickQuotePrepNotes;
  durationValue: string;
  plannedStartDateText: string;
  plannedStartDateExact: string;
  photos: QuickQuoteLocalPhoto[];
  photosNotRequired: boolean;
  siteVisitCompleted: boolean;
}): boolean {
  return (
    Boolean(options.prepNotes.measurements.trim()) ||
    Boolean(options.prepNotes.materialsRequired.trim()) ||
    Boolean(options.prepNotes.accessRequirements.trim()) ||
    Boolean(options.prepNotes.additionalNotes.trim()) ||
    Boolean(options.durationValue.trim()) ||
    Boolean(options.plannedStartDateText.trim()) ||
    Boolean(options.plannedStartDateExact.trim()) ||
    options.photos.length > 0 ||
    options.photosNotRequired ||
    options.siteVisitCompleted
  );
}

export function QuickQuotePreparation({
  customerName,
  emailAddress,
  phoneNumber,
  propertyAddress,
  jobDescription,
  onJobDescriptionChange,
  prepNotes,
  onPrepNotesChange,
  photos,
  onPhotosChange,
  photosNotRequired,
  onPhotosNotRequiredChange,
  siteVisitCompleted,
  onSiteVisitCompletedChange,
  durationValue,
  onDurationValueChange,
  durationUnit,
  onDurationUnitChange,
  estimatedDuration,
  plannedStartDateText,
  onPlannedStartDateTextChange,
  plannedStartDateExact,
  onPlannedStartDateExactChange,
  materialsCost,
  onMaterialsCostChange,
  labourCost,
  onLabourCostChange,
  additionalCost,
  onAdditionalCostChange,
  marginCost,
  onMarginCostChange,
  customerTotal,
  onCustomerTotalChange,
  onSuggestCustomerTotal,
  jobDescriptionMaxLength,
}: {
  customerName: string;
  emailAddress: string;
  phoneNumber: string;
  propertyAddress: string;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  prepNotes: QuickQuotePrepNotes;
  onPrepNotesChange: (next: QuickQuotePrepNotes) => void;
  photos: QuickQuoteLocalPhoto[];
  onPhotosChange: (next: QuickQuoteLocalPhoto[]) => void;
  photosNotRequired: boolean;
  onPhotosNotRequiredChange: (value: boolean) => void;
  siteVisitCompleted: boolean;
  onSiteVisitCompletedChange: (value: boolean) => void;
  durationValue: string;
  onDurationValueChange: (value: string) => void;
  durationUnit: DurationUnit;
  onDurationUnitChange: (value: DurationUnit) => void;
  estimatedDuration: string;
  plannedStartDateText: string;
  onPlannedStartDateTextChange: (value: string) => void;
  plannedStartDateExact: string;
  onPlannedStartDateExactChange: (value: string) => void;
  materialsCost: string;
  onMaterialsCostChange: (value: string) => void;
  labourCost: string;
  onLabourCostChange: (value: string) => void;
  additionalCost: string;
  onAdditionalCostChange: (value: string) => void;
  marginCost: string;
  onMarginCostChange: (value: string) => void;
  customerTotal: string;
  onCustomerTotalChange: (value: string) => void;
  onSuggestCustomerTotal: () => void;
  jobDescriptionMaxLength: number;
}) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const defaultDetailsOpen = useMemo(
    () =>
      hasOptionalDetailContent({
        prepNotes,
        durationValue,
        plannedStartDateText,
        plannedStartDateExact,
        photos,
        photosNotRequired,
        siteVisitCompleted,
      }),
    // Open by default only from the initial saved/optional content — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen);

  const incomplete = getIncompleteQuoteReadinessItems({
    customerName,
    emailAddress,
    phoneNumber,
    propertyAddress,
    notes: prepNotes,
    jobDescription,
    photoCount: photos.length,
    photosNotRequired,
    siteVisitCompleted,
    durationValue,
    plannedStartDateText,
    plannedStartDateExact,
    estimatedPrice: customerTotal,
    paymentTermsSupported: false,
    // AI extracts structure from the main job notes — don't nag about optional fields.
    aiNotesFirst: true,
  });
  const grouped = groupIncompleteReadinessByCategory(incomplete);
  const showSiteVisitToggle = !prepNotes.measurements.trim();

  function updateNote<K extends keyof QuickQuotePrepNotes>(
    key: K,
    value: QuickQuotePrepNotes[K]
  ) {
    onPrepNotesChange({ ...prepNotes, [key]: value });
  }

  function handlePhotoFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setPhotoError(null);
    const next: QuickQuoteLocalPhoto[] = [...photos];

    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) {
        setPhotoError("Please choose image files only.");
        continue;
      }
      next.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      });
    }

    onPhotosChange(next);
    if (next.length > 0) {
      onPhotosNotRequiredChange(false);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removePhoto(id: string) {
    const target = photos.find((photo) => photo.id === id);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onPhotosChange(photos.filter((photo) => photo.id !== id));
  }

  return (
    <div className="qf-qq-prep">
      <SectionCard className="qf-card-form qf-qq-prep-card">
        <SectionHeading
          title="Job notes"
          hint="Write it the way you heard it — measurements, materials, access, timing, customer requests. AI will organise the quote."
        />
        <div className="mt-5">
          <div className="qf-textarea-wrap">
            <label htmlFor="jobDescription" className="qf-field-label">
              What needs doing?
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(event) =>
                onJobDescriptionChange(
                  event.target.value.slice(0, jobDescriptionMaxLength)
                )
              }
              rows={14}
              required
              maxLength={jobDescriptionMaxLength}
              placeholder={
                "e.g. Customer wants full bathroom refit, suite staying roughly where it is, grey tiles, approx 2.1 x 1.8, park on the road, hoping for week commencing 18th, side gate access only…"
              }
              className="form-textarea qf-site-notes-textarea mt-2"
            />
            <p className="qf-char-count" aria-live="polite">
              {jobDescription.length.toLocaleString()} /{" "}
              {jobDescriptionMaxLength.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="qf-qq-optional">
          <button
            type="button"
            className="qf-qq-optional-toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <span>Add more details (optional)</span>
            <span className="qf-qq-optional-chevron" aria-hidden="true">
              {detailsOpen ? "−" : "+"}
            </span>
          </button>
          <p className="qf-qq-optional-hint">
            Only if you want to split things out — not required. Messy notes in
            the box above are enough.
          </p>

          {detailsOpen ? (
            <div className="qf-qq-optional-body space-y-5">
              <NoteField
                id="prepMeasurements"
                label="Measurements"
                value={prepNotes.measurements}
                onChange={(value) => updateNote("measurements", value)}
                placeholder="e.g. Bathroom 2.1m × 1.8m…"
              />
              <NoteField
                id="prepMaterials"
                label="Materials"
                value={prepNotes.materialsRequired}
                onChange={(value) => updateNote("materialsRequired", value)}
                placeholder="e.g. Close-coupled suite, grey wall tiles…"
              />
              <NoteField
                id="prepAccess"
                label="Access requirements"
                value={prepNotes.accessRequirements}
                onChange={(value) => updateNote("accessRequirements", value)}
                placeholder="e.g. Side gate, park on road…"
              />
              <NoteField
                id="prepAdditional"
                label="Additional notes"
                value={prepNotes.additionalNotes}
                onChange={(value) => updateNote("additionalNotes", value)}
                placeholder="Anything else worth capturing…"
              />

              <div className="qf-qq-photos">
                <p className="qf-field-label">Photos / site conditions</p>
                <p className="qf-qq-photos-hint">
                  Soft optional check — upload a photo, or mark that photos are
                  not needed.
                </p>
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  accept="image/*"
                  multiple
                  className="qf-qq-photos-input"
                  onChange={(event) => handlePhotoFiles(event.target.files)}
                />
                <div className="qf-qq-photos-actions">
                  <label
                    htmlFor={fileInputId}
                    className="qf-btn-secondary qf-qq-photos-add"
                  >
                    Add photos
                  </label>
                  <label className="qf-qq-photos-skip">
                    <input
                      type="checkbox"
                      checked={photosNotRequired}
                      onChange={(event) => {
                        onPhotosNotRequiredChange(event.target.checked);
                      }}
                    />
                    No photos needed
                  </label>
                </div>
                {photoError ? (
                  <p className="qf-qq-photos-error" role="alert">
                    {photoError}
                  </p>
                ) : null}
                {photos.length > 0 ? (
                  <ul className="qf-qq-photos-list">
                    {photos.map((photo) => (
                      <li key={photo.id} className="qf-qq-photos-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.previewUrl}
                          alt={photo.name}
                          className="qf-qq-photos-thumb"
                        />
                        <span className="qf-qq-photos-name">{photo.name}</span>
                        <button
                          type="button"
                          className="qf-qq-photos-remove"
                          onClick={() => removePhoto(photo.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {showSiteVisitToggle ? (
                <label className="qf-qq-photos-skip">
                  <input
                    type="checkbox"
                    checked={siteVisitCompleted}
                    onChange={(event) =>
                      onSiteVisitCompletedChange(event.target.checked)
                    }
                  />
                  Site visit completed / not needed right now
                </label>
              ) : null}

              <div>
                <label htmlFor="durationValue" className="qf-field-label">
                  Duration
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
            </div>
          ) : null}
        </div>
      </SectionCard>

      {grouped.length > 0 ? (
        <section
          className="qf-qq-readiness"
          aria-live="polite"
          aria-label="Quote readiness"
        >
          <h2 className="qf-qq-readiness-title">Quote readiness</h2>
          <p className="qf-qq-readiness-copy">
            Soft reminders only — messy job notes are enough to generate. Nothing
            here blocks creating or sending the quote.
          </p>

          <div className="qf-qq-readiness-groups">
            {grouped.map((group) => (
              <div key={group.category} className="qf-qq-readiness-group">
                <h3 className="qf-qq-readiness-group-title">{group.label}</h3>
                <ul className="qf-qq-readiness-list">
                  {group.items.map((entry) => (
                    <li key={entry.id} className="qf-qq-readiness-item">
                      <p className="qf-qq-readiness-label">{entry.traderLabel}</p>
                      <p className="qf-qq-readiness-detail">{entry.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <SectionCard className="qf-card-form qf-qq-prep-card">
        <SectionHeading
          title="Internal quote breakdown"
          hint="For your costing only — not shown as line items on the customer proposal."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <MoneyField
            id="materialsCost"
            label="Materials cost"
            value={materialsCost}
            onChange={onMaterialsCostChange}
            placeholder="e.g. 320"
          />
          <MoneyField
            id="labourCost"
            label="Labour cost"
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
          <MoneyField
            id="marginCost"
            label="Profit / margin"
            value={marginCost}
            onChange={onMarginCostChange}
            placeholder="e.g. 100"
            helper="Your mark-up or contingency — stays internal."
          />
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form qf-qq-prep-card">
        <SectionHeading
          title="Customer proposal price"
          hint="This is the agreed/final price customers see on the proposal."
        />
        <div className="mt-5 max-w-sm space-y-3">
          <MoneyField
            id="estimatedPrice"
            name="estimatedPrice"
            label="Final price for customer"
            value={customerTotal}
            onChange={onCustomerTotalChange}
            placeholder="e.g. 940"
          />
          <button
            type="button"
            className="qf-btn-secondary qf-qq-add-up"
            onClick={onSuggestCustomerTotal}
          >
            Use internal total as customer price
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
