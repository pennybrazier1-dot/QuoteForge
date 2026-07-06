"use client";

import { useJourney } from "@/lib/customer-journey/journey-provider";
import { JourneyFooter } from "@/components/customer-journey/layout/journey-footer";
import { JourneyHeader } from "@/components/customer-journey/layout/journey-header";
import {
  JourneyMobileProgress,
  JourneySidebar,
} from "@/components/customer-journey/layout/journey-sidebar";
import { StepDetails } from "@/components/customer-journey/steps/step-details";
import { StepMeasurements } from "@/components/customer-journey/steps/step-measurements";
import { StepPhotos } from "@/components/customer-journey/steps/step-photos";
import { StepProject } from "@/components/customer-journey/steps/step-project";
import { StepProperty } from "@/components/customer-journey/steps/step-property";
import { StepReview } from "@/components/customer-journey/steps/step-review";
import { StepThankYou } from "@/components/customer-journey/steps/step-thank-you";
import { StepTrade } from "@/components/customer-journey/steps/step-trade";
import { StepTradeQuestions } from "@/components/customer-journey/steps/step-trade-questions";

function JourneyStepContent() {
  const { state } = useJourney();

  switch (state.currentStepId) {
    case "trade":
      return <StepTrade />;
    case "details":
      return <StepDetails />;
    case "property":
      return <StepProperty />;
    case "project":
      return <StepProject />;
    case "photos":
      return <StepPhotos />;
    case "measurements":
      return <StepMeasurements />;
    case "trade_questions":
      return <StepTradeQuestions />;
    case "review":
      return <StepReview />;
    case "thank_you":
      return <StepThankYou />;
    default:
      return <StepTrade />;
  }
}

export function CustomerJourneyShell() {
  const { state } = useJourney();
  const isThankYou = state.currentStepId === "thank_you";

  if (isThankYou) {
    return (
      <div className="cj-page">
        <JourneyHeader />
        <main className="cj-thankyou-main" id="cj-main">
          <div className="cj-main-card cj-main-card-centered cj-step-animate">
            <StepThankYou />
          </div>
        </main>
        <JourneyFooter />
      </div>
    );
  }

  return (
    <div className="cj-page">
      <JourneyHeader />
      <div className="cj-layout">
        <JourneyMobileProgress />
        <JourneySidebar />
        <main className="cj-main" id="cj-main">
          <div className="cj-main-card" key={state.currentStepId}>
            <JourneyStepContent />
          </div>
        </main>
      </div>
      <JourneyFooter />
    </div>
  );
}
