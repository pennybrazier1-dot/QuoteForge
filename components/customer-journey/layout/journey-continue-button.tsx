"use client";

import { ArrowRightIcon } from "@/components/customer-journey/ui/journey-icons";

type JourneyContinueButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  showBack?: boolean;
  onBack?: () => void;
};

export function JourneyContinueButton({
  onClick,
  disabled = false,
  label = "Continue",
  hint = "Takes less than a minute",
  showBack = false,
  onBack,
}: JourneyContinueButtonProps) {
  return (
    <div className="cj-actions">
      <div className="cj-actions-secondary">
        {showBack && onBack ? (
          <button type="button" className="cj-btn-back" onClick={onBack}>
            Back
          </button>
        ) : null}
      </div>
      <div className="cj-actions-primary">
        <button
          type="button"
          className="cj-btn-primary"
          onClick={onClick}
          disabled={disabled}
        >
          <span>{label}</span>
          <ArrowRightIcon className="cj-btn-primary-icon" />
        </button>
        {hint ? <p className="cj-actions-hint">{hint}</p> : null}
      </div>
    </div>
  );
}
