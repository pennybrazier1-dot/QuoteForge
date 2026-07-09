"use client";

import { PROPERTY_TYPES } from "@/lib/customer-journey/constants";
import { needsServiceSelection } from "@/lib/customer-journey/business-services";
import { getTradeQuestions } from "@/lib/customer-journey/trade-questions";
import {
  getEffectiveTrade,
  getStepNumber,
  getTotalSteps,
} from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import type { JourneyStepId } from "@/lib/customer-journey/types";
import type { MeasurementField } from "@/lib/customer-journey/types";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import { JourneyStepHeader } from "@/components/customer-journey/ui/journey-ui";

function ReviewSection({
  title,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  stepId: JourneyStepId;
  onEdit: (stepId: JourneyStepId) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="cj-review-section">
      <div className="cj-review-section-header">
        <h2 className="cj-review-section-title">{title}</h2>
        <button
          type="button"
          className="cj-review-edit"
          onClick={() => onEdit(stepId)}
          aria-label={`Edit ${title}`}
        >
          Edit
        </button>
      </div>
      <div className="cj-review-section-body">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cj-review-row">
      <span className="cj-review-label">{label}</span>
      <span className="cj-review-value">{value}</span>
    </div>
  );
}

export function StepReview() {
  const { state, tradesperson, setStep, submit, isSubmitting, submitError } =
    useJourney();
  const { formData } = state;
  const trade = getEffectiveTrade(formData, tradesperson);
  const propertyLabel =
    PROPERTY_TYPES.find((type) => type.id === formData.propertyType)?.label ??
    "Not selected";
  const tradeQuestions = getTradeQuestions(trade);
  const { contactName } = tradesperson;

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("review", tradesperson)}
        totalSteps={getTotalSteps(tradesperson)}
        title="Nearly done"
        description="Check it looks right, then send."
      />

      <div className="cj-review-stack">
        {needsServiceSelection(tradesperson) ? (
          <ReviewSection title="Service" stepId="work_type" onEdit={setStep}>
            <ReviewRow
              label="Service"
              value={formData.selectedService ?? "Not selected"}
            />
          </ReviewSection>
        ) : null}

        <ReviewSection title="Your details" stepId="details" onEdit={setStep}>
          <ReviewRow label="Name" value={formData.name} />
          <ReviewRow label="Mobile" value={formData.mobile} />
          <ReviewRow
            label="Email"
            value={formData.email.trim() || "Not provided"}
          />
        </ReviewSection>

        <ReviewSection title="Job location" stepId="property" onEdit={setStep}>
          <ReviewRow
            label="Address"
            value={[formData.addressLine1, formData.addressLine2]
              .filter(Boolean)
              .join(", ")}
          />
          <ReviewRow label="Postcode" value={formData.postcode} />
          <ReviewRow label="Property" value={propertyLabel} />
        </ReviewSection>

        <ReviewSection title="What you told us" stepId="project" onEdit={setStep}>
          <p className="cj-review-paragraph">{formData.projectDescription}</p>
        </ReviewSection>

        <ReviewSection title="Photos" stepId="photos" onEdit={setStep}>
          <ReviewRow
            label="Photos"
            value={
              formData.photos.length
                ? `${formData.photos.length} attached`
                : "None — that's fine"
            }
          />
        </ReviewSection>

        <ReviewSection title="Sizes" stepId="measurements" onEdit={setStep}>
          <ReviewRow
            label="Sizes known"
            value={
              formData.knowsMeasurements === "yes"
                ? "Yes — rough sizes provided"
                : `${contactName} will measure on site`
            }
          />
          {formData.knowsMeasurements === "yes"
            ? formData.measurements
                .filter((field: MeasurementField) => field.value.trim())
                .map((field: MeasurementField) => (
                  <ReviewRow
                    key={field.id}
                    label={field.label}
                    value={field.value}
                  />
                ))
            : null}
        </ReviewSection>

        <ReviewSection
          title="A few more details"
          stepId="trade_questions"
          onEdit={setStep}
        >
          {tradeQuestions
            .filter((question) => formData.tradeAnswers[question.id]?.trim())
            .map((question) => (
              <ReviewRow
                key={question.id}
                label={question.label}
                value={formData.tradeAnswers[question.id]}
              />
            ))}
        </ReviewSection>
      </div>

      {submitError ? (
        <p className="cj-submit-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <JourneyContinueButton
        onClick={() => void submit()}
        disabled={isSubmitting}
        label={isSubmitting ? "Sending…" : "Send my request"}
        hint={`${contactName} will be in touch soon`}
        onBack={() => setStep("trade_questions")}
        showBack
      />
    </div>
  );
}
