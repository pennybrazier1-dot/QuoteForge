"use client";

import { useJourney } from "@/lib/customer-journey/journey-provider";
import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import { JourneyStepHeader } from "@/components/customer-journey/ui/journey-ui";

export function StepWelcome() {
  const { tradesperson, goNext } = useJourney();
  const { businessName } = tradesperson;

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("welcome", tradesperson)}
        totalSteps={getTotalSteps(tradesperson)}
        title={`Request a Quote from ${businessName}`}
        description={`Tell us a little about the work you need and we'll make sure ${businessName} has everything needed before arranging a visit.`}
      />

      <JourneyContinueButton
        onClick={goNext}
        label="Get started"
        hint="Takes about 3–5 minutes"
      />
    </div>
  );
}
