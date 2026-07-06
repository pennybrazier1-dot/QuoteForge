"use client";

import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import type { MeasurementField } from "@/lib/customer-journey/types";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import {
  JourneyCard,
  JourneyField,
  JourneyHelperBox,
  JourneyInput,
  JourneyStepHeader,
} from "@/components/customer-journey/ui/journey-ui";

export function StepMeasurements() {
  const {
    state,
    tradesperson,
    updateField,
    goNext,
    goBack,
    canContinue,
    declineMeasurementsAndContinue,
  } = useJourney();
  const { knowsMeasurements, measurements } = state.formData;

  const setMeasurement = (id: string, value: string) => {
    const next = measurements.map((field: MeasurementField) =>
      field.id === id ? { ...field, value } : field
    );
    updateField("measurements", next);
  };

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("measurements", tradesperson)}
        totalSteps={getTotalSteps(tradesperson)}
        title="Do you know any sizes?"
        description="Totally optional — John can measure on site."
      />

      <div className="cj-choice-row" role="radiogroup" aria-label="Do you know any sizes?">
        <JourneyCard
          interactive
          selected={knowsMeasurements === "yes"}
          className="cj-choice-card cj-choice-card-wide"
          ariaLabel="Yes, I have a rough idea"
          onClick={() => updateField("knowsMeasurements", "yes")}
        >
          <span className="cj-choice-card-title">Yes</span>
          <span className="cj-choice-card-subtitle">I have a rough idea</span>
        </JourneyCard>
        <JourneyCard
          interactive
          selected={knowsMeasurements === "no"}
          className="cj-choice-card cj-choice-card-wide"
          ariaLabel="No, John can measure on site"
          onClick={declineMeasurementsAndContinue}
        >
          <span className="cj-choice-card-title">No</span>
          <span className="cj-choice-card-subtitle">John can measure on site</span>
        </JourneyCard>
      </div>

      {knowsMeasurements === "yes" ? (
        <div className="cj-form-stack">
          <JourneyHelperBox title="Rough is fine">
            <p>
              Any numbers you have — leave blank anything you&apos;re not sure
              about.
            </p>
          </JourneyHelperBox>
          {measurements.map((field: MeasurementField) => (
            <JourneyField
              key={field.id}
              label={`${field.label} (optional)`}
              htmlFor={`cj-measure-${field.id}`}
            >
              <JourneyInput
                id={`cj-measure-${field.id}`}
                type="text"
                inputMode="decimal"
                value={field.value}
                onChange={(value) => setMeasurement(field.id, value)}
                placeholder="e.g. 3 metres wide"
              />
            </JourneyField>
          ))}
        </div>
      ) : null}

      {knowsMeasurements === "yes" ? (
        <JourneyContinueButton
          onClick={goNext}
          onBack={goBack}
          showBack
          disabled={!canContinue}
        />
      ) : null}
    </div>
  );
}
