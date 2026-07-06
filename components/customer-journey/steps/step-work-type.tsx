"use client";

import { useState } from "react";
import {
  CANT_SEE_SERVICE_LABEL,
  getBusinessServiceOptions,
  getWorkTypeStepCopy,
  SERVICE_PICKER_HINT,
} from "@/lib/customer-journey/business-services";
import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import { SparkleIcon, TradeIcon } from "@/components/customer-journey/ui/journey-icons";
import {
  JourneyCard,
  JourneyHelperBox,
  JourneyStepHeader,
} from "@/components/customer-journey/ui/journey-ui";

export function StepWorkType() {
  const { state, tradesperson, selectServiceAndContinue } = useJourney();
  const services = getBusinessServiceOptions(tradesperson);
  const copy = getWorkTypeStepCopy(tradesperson.businessType);
  const [showCantSeeService, setShowCantSeeService] = useState(false);

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("work_type", tradesperson)}
        totalSteps={getTotalSteps(tradesperson)}
        title={copy.title}
        description={copy.description}
      />

      <div
        className="cj-trade-grid"
        role="radiogroup"
        aria-label={copy.ariaLabel}
      >
        {services.map((service, index) => {
          const selected = state.formData.selectedService === service.label;

          return (
            <JourneyCard
              key={`${service.label}-${index}`}
              interactive
              selected={selected}
              className="cj-trade-card"
              ariaLabel={service.label}
              onClick={() => selectServiceAndContinue(service.label)}
            >
              <TradeIcon name={service.icon} className="cj-trade-card-icon" />
              <span className="cj-trade-card-label">{service.label}</span>
            </JourneyCard>
          );
        })}
      </div>

      <div className="cj-service-miss">
        <button
          type="button"
          className="cj-service-miss-trigger"
          aria-expanded={showCantSeeService}
          onClick={() => setShowCantSeeService((open) => !open)}
        >
          {CANT_SEE_SERVICE_LABEL}
        </button>
        {showCantSeeService ? (
          <p className="cj-service-miss-body">
            Pick the closest match for now — you can describe exactly what you need
            in the project details step.
          </p>
        ) : null}
      </div>

      <JourneyHelperBox title="Not sure which to pick?">
        <div className="cj-helper-inline">
          <SparkleIcon className="cj-helper-inline-icon" />
          <p>{SERVICE_PICKER_HINT}</p>
        </div>
      </JourneyHelperBox>
    </div>
  );
}
