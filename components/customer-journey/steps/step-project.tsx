"use client";

import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import {
  JourneyHelperBox,
  JourneyStepHeader,
  JourneyTextarea,
} from "@/components/customer-journey/ui/journey-ui";

export function StepProject() {
  const { state, updateField, goNext, goBack, canContinue } = useJourney();

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("project")}
        totalSteps={getTotalSteps()}
        title="Tell us what you need"
        description="A sentence or two is fine — say it how you'd tell a friend."
      />

      <div className="cj-field">
        <JourneyTextarea
          id="cj-project"
          value={state.formData.projectDescription}
          onChange={(value) => updateField("projectDescription", value)}
          placeholder="e.g. The kitchen lights keep flickering and I'd like new spotlights fitted..."
          rows={7}
        />
      </div>

      <JourneyHelperBox title="Don't overthink it">
        <p>
          There are no wrong answers. If John needs more detail, he&apos;ll ask
          when he calls you.
        </p>
      </JourneyHelperBox>

      <JourneyContinueButton
        onClick={goNext}
        onBack={goBack}
        showBack
        disabled={!canContinue}
      />
    </div>
  );
}
