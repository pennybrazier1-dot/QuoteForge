"use client";

import { PROPERTY_TYPES } from "@/lib/customer-journey/constants";
import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import {
  JourneyCard,
  JourneyField,
  JourneyInput,
  JourneyStepHeader,
} from "@/components/customer-journey/ui/journey-ui";

export function StepProperty() {
  const { state, tradesperson, updateField, goNext, goBack, canContinue } = useJourney();
  const { addressLine1, addressLine2, postcode, propertyType } = state.formData;

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("property", tradesperson)}
        totalSteps={getTotalSteps(tradesperson)}
        title="Where is the job?"
        description="So John knows where to come if a visit is needed."
      />

      <div className="cj-form-stack">
        <JourneyField label="Postcode" htmlFor="cj-postcode">
          <JourneyInput
            id="cj-postcode"
            value={postcode}
            onChange={(value) => updateField("postcode", value)}
            placeholder="e.g. SW1A 1AA"
            autoComplete="postal-code"
          />
        </JourneyField>

        <JourneyField
          label="Street address"
          htmlFor="cj-address-1"
          hint="House number and street name"
        >
          <JourneyInput
            id="cj-address-1"
            value={addressLine1}
            onChange={(value) => updateField("addressLine1", value)}
            placeholder="e.g. 12 Oak Avenue"
            autoComplete="address-line1"
          />
        </JourneyField>

        <JourneyField label="Flat or building name (optional)" htmlFor="cj-address-2">
          <JourneyInput
            id="cj-address-2"
            value={addressLine2}
            onChange={(value) => updateField("addressLine2", value)}
            placeholder="Only if you need to add one"
            autoComplete="address-line2"
          />
        </JourneyField>

        <div className="cj-field">
          <p className="cj-field-label" id="cj-property-type-label">
            What type of property is it?
          </p>
          <div
            className="cj-choice-grid cj-choice-grid-compact"
            role="radiogroup"
            aria-labelledby="cj-property-type-label"
          >
            {PROPERTY_TYPES.map((type) => {
              const selected = propertyType === type.id;

              return (
                <JourneyCard
                  key={type.id}
                  interactive
                  selected={selected}
                  className="cj-choice-card"
                  ariaLabel={type.label}
                  onClick={() => updateField("propertyType", type.id)}
                >
                  <span>{type.label}</span>
                </JourneyCard>
              );
            })}
          </div>
        </div>
      </div>

      <JourneyContinueButton
        onClick={goNext}
        onBack={goBack}
        showBack
        disabled={!canContinue}
      />
    </div>
  );
}
