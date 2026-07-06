"use client";

import { TRADE_OPTIONS } from "@/lib/customer-journey/constants";
import { getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import { SparkleIcon, TradeIcon } from "@/components/customer-journey/ui/journey-icons";
import {
  JourneyCard,
  JourneyHelperBox,
  JourneyStepHeader,
} from "@/components/customer-journey/ui/journey-ui";

export function StepTrade() {
  const { state, selectTradeAndContinue } = useJourney();

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={1}
        totalSteps={getTotalSteps()}
        title="What type of work do you need?"
        description="Tap the closest match — we'll take you to the next step."
      />

      <div
        className="cj-trade-grid"
        role="radiogroup"
        aria-label="Type of work"
      >
        {TRADE_OPTIONS.map((trade) => {
          const selected = state.formData.trade === trade.id;

          return (
            <JourneyCard
              key={trade.id}
              interactive
              selected={selected}
              className="cj-trade-card"
              ariaLabel={trade.label}
              onClick={() => selectTradeAndContinue(trade.id)}
            >
              <TradeIcon name={trade.icon} className="cj-trade-card-icon" />
              <span className="cj-trade-card-label">{trade.label}</span>
            </JourneyCard>
          );
        })}
      </div>

      <JourneyHelperBox title="Not sure which to pick?">
        <div className="cj-helper-inline">
          <SparkleIcon className="cj-helper-inline-icon" />
          <p>
            Choose the closest option. John can always clarify the details when
            he gets in touch — you don&apos;t need to get it perfect.
          </p>
        </div>
      </JourneyHelperBox>
    </div>
  );
}
