"use client";

import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import {
  JourneyField,
  JourneyHelperBox,
  JourneyInput,
  JourneyStepHeader,
} from "@/components/customer-journey/ui/journey-ui";

export function StepDetails() {
  const { state, updateField, goNext, goBack, canContinue } = useJourney();
  const { name, mobile, email } = state.formData;

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("details")}
        totalSteps={getTotalSteps()}
        title="How can we reach you?"
        description="Just your name and mobile — that's all we need to get started."
      />

      <div className="cj-form-stack">
        <JourneyField label="Your name" htmlFor="cj-name">
          <JourneyInput
            id="cj-name"
            value={name}
            onChange={(value) => updateField("name", value)}
            placeholder="e.g. Sarah"
            autoComplete="name"
          />
        </JourneyField>

        <JourneyField
          label="Mobile number"
          htmlFor="cj-mobile"
          hint="John will call or text about your job — nothing else."
        >
          <JourneyInput
            id="cj-mobile"
            type="tel"
            inputMode="tel"
            value={mobile}
            onChange={(value) => updateField("mobile", value)}
            placeholder="07XXX XXXXXX"
            autoComplete="tel"
          />
        </JourneyField>

        <JourneyField
          label="Email (optional)"
          htmlFor="cj-email"
          hint="Handy if you'd like your quote in writing."
        >
          <JourneyInput
            id="cj-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(value) => updateField("email", value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </JourneyField>
      </div>

      <JourneyHelperBox title="Your details stay private">
        <p>
          We only use this to respond to your request. No spam, no sharing with
          anyone else.
        </p>
      </JourneyHelperBox>

      <JourneyContinueButton
        onClick={goNext}
        onBack={goBack}
        showBack
        disabled={!canContinue}
        hint="Nearly there — just a few more quick steps"
      />
    </div>
  );
}
