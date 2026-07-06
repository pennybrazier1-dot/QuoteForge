"use client";

import {
  getBusinessServiceOptions,
  getWorkTypeStepCopy,
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

      <JourneyHelperBox title="Not sure which to pick?">
        <div className="cj-helper-inline">
          <SparkleIcon className="cj-helper-inline-icon" />
          <p>
            Choose the closest option. {tradesperson.contactName} can always
            clarify the details when they get in touch — you don&apos;t need to
            get it perfect.
          </p>
        </div>
      </JourneyHelperBox>
    </div>
  );
}
