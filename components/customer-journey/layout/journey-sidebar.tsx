"use client";

import { useJourney } from "@/lib/customer-journey/journey-provider";
import { JOURNEY_STEPS, WHAT_HAPPENS_NEXT } from "@/lib/customer-journey/constants";
import { getStepIndex } from "@/lib/customer-journey/journey-state";
import {
  CheckIcon,
  ClockIcon,
  LockIcon,
  StepIcon,
} from "@/components/customer-journey/ui/journey-icons";
import { JourneyCard } from "@/components/customer-journey/ui/journey-ui";

export function JourneySidebar() {
  const { state, tradesperson, setStep } = useJourney();
  const currentIndex = getStepIndex(state.currentStepId);

  return (
    <aside className="cj-sidebar" aria-label="Quote request progress">
      <div className="cj-sidebar-intro">
        <h2 className="cj-sidebar-title">Request a Quote</h2>
        <p className="cj-sidebar-subtitle">It only takes 3–5 minutes</p>
      </div>

      <nav className="cj-progress" aria-label="Steps">
        <ol className="cj-progress-list">
          {JOURNEY_STEPS.map((step, index) => {
            const isActive = step.id === state.currentStepId;
            const isComplete = index < currentIndex;
            const isLast = index === JOURNEY_STEPS.length - 1;

            return (
              <li
                key={step.id}
                className={[
                  "cj-progress-item",
                  isLast ? "cj-progress-item-last" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className={[
                    "cj-progress-button",
                    isActive ? "cj-progress-button-active" : "",
                    isComplete ? "cj-progress-button-complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (index <= currentIndex) {
                      setStep(step.id);
                    }
                  }}
                  disabled={index > currentIndex}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span
                    className={[
                      "cj-progress-marker",
                      isActive ? "cj-progress-marker-active" : "",
                      isComplete ? "cj-progress-marker-complete" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  >
                    {isComplete ? (
                      <CheckIcon className="cj-progress-check" />
                    ) : isActive ? (
                      <span className="cj-progress-number">{step.number}</span>
                    ) : (
                      <StepIcon name={step.icon} className="cj-progress-icon" />
                    )}
                  </span>
                  <span className="cj-progress-copy">
                    <span className="cj-progress-title">{step.title}</span>
                    <span className="cj-progress-description">
                      {step.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="cj-sidebar-cards">
        <JourneyCard inset className="cj-info-card">
          <div className="cj-info-card-header">
            <ClockIcon className="cj-info-card-icon" />
            <h3 className="cj-info-card-title">What happens next?</h3>
          </div>
          <ul className="cj-info-list">
            {WHAT_HAPPENS_NEXT.map((item) => (
              <li key={item} className="cj-info-list-item">
                <CheckIcon className="cj-info-list-icon" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </JourneyCard>

        <JourneyCard inset className="cj-info-card">
          <div className="cj-info-card-header">
            <LockIcon className="cj-info-card-icon" />
            <h3 className="cj-info-card-title">Your information is secure</h3>
          </div>
          <p className="cj-info-card-body">
            We only use your details to respond to this enquiry. Nothing is
            shared with third parties.
          </p>
        </JourneyCard>

        <JourneyCard inset className="cj-info-card cj-contact-card">
          <div className="cj-contact-avatar" aria-hidden="true">
            {tradesperson.contactName.charAt(0)}
          </div>
          <div>
            <p className="cj-contact-label">Need help? Call directly</p>
            <p className="cj-contact-name">{tradesperson.contactName}</p>
            <a href={`tel:${tradesperson.phone}`} className="cj-contact-phone">
              {tradesperson.phone}
            </a>
          </div>
        </JourneyCard>
      </div>
    </aside>
  );
}

export function JourneyMobileProgress() {
  const { state } = useJourney();
  const currentIndex = getStepIndex(state.currentStepId);
  const currentStep = JOURNEY_STEPS[currentIndex];

  return (
    <div
      className="cj-mobile-progress"
      role="status"
      aria-live="polite"
      aria-label={`Step ${currentIndex + 1} of ${JOURNEY_STEPS.length}: ${currentStep?.title}`}
    >
      <p className="cj-mobile-progress-eyebrow">
        Step {currentIndex + 1} of {JOURNEY_STEPS.length}
      </p>
      <p className="cj-mobile-progress-title">{currentStep?.title}</p>
      <div className="cj-mobile-progress-bar" aria-hidden="true">
        {JOURNEY_STEPS.map((step, index) => (
          <span
            key={step.id}
            className={[
              "cj-mobile-progress-dot",
              index < currentIndex ? "cj-mobile-progress-dot-complete" : "",
              index === currentIndex ? "cj-mobile-progress-dot-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
