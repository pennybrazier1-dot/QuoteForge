"use client";

import { getTradeQuestions } from "@/lib/customer-journey/trade-questions";
import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import {
  JourneyCard,
  JourneyField,
  JourneyHelperBox,
  JourneyStepHeader,
  JourneyTextarea,
} from "@/components/customer-journey/ui/journey-ui";

export function StepTradeQuestions() {
  const { state, setTradeAnswer, goNext, goBack, canContinue } = useJourney();
  const questions = getTradeQuestions(state.formData.trade);

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("trade_questions")}
        totalSteps={getTotalSteps()}
        title="Nearly there — just a few taps"
        description="These help John prepare your quote. Tap to answer."
      />

      <JourneyHelperBox title="You're almost done">
        <p>This is the last step before you review everything. No typing unless you want to.</p>
      </JourneyHelperBox>

      <div className="cj-form-stack">
        {questions.map((question) => {
          const value = state.formData.tradeAnswers[question.id] ?? "";
          const isOptional = question.required === false;

          return (
            <div key={question.id} className="cj-field">
              <p className="cj-field-label">
                {question.label}
                {isOptional ? "" : ""}
              </p>
              {question.helperText ? (
                <p className="cj-field-hint">{question.helperText}</p>
              ) : null}

              {question.type === "textarea" ? (
                <JourneyTextarea
                  id={`cj-q-${question.id}`}
                  value={value}
                  onChange={(next) => setTradeAnswer(question.id, next)}
                  placeholder={question.placeholder}
                  rows={3}
                />
              ) : null}

              {question.type === "select" || question.type === "radio" ? (
                <div className="cj-choice-grid cj-choice-grid-stacked">
                  {(question.options ?? []).map((option) => (
                    <JourneyCard
                      key={option}
                      interactive
                      selected={value === option}
                      className="cj-choice-card cj-choice-card-wide"
                      ariaLabel={option}
                      onClick={() => setTradeAnswer(question.id, option)}
                    >
                      <span>{option}</span>
                    </JourneyCard>
                  ))}
                </div>
              ) : null}

              {question.type === "text" ? (
                <JourneyField label="" htmlFor={`cj-q-${question.id}`}>
                  <input
                    id={`cj-q-${question.id}`}
                    type="text"
                    value={value}
                    onChange={(event) =>
                      setTradeAnswer(question.id, event.target.value)
                    }
                    placeholder={question.placeholder}
                    className="cj-input"
                  />
                </JourneyField>
              ) : null}
            </div>
          );
        })}
      </div>

      <JourneyContinueButton
        onClick={goNext}
        onBack={goBack}
        showBack
        disabled={!canContinue}
        hint="One more step — then you can send"
      />
    </div>
  );
}
