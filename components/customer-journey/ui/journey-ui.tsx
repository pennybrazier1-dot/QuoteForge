import type { ReactNode } from "react";

type JourneyCardProps = {
  children: ReactNode;
  className?: string;
  inset?: boolean;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
};

export function JourneyCard({
  children,
  className = "",
  inset = false,
  selected = false,
  interactive = false,
  onClick,
  ariaLabel,
}: JourneyCardProps) {
  const classes = [
    "cj-card",
    inset ? "cj-card-inset" : "",
    selected ? "cj-card-selected" : "",
    interactive ? "cj-card-interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (interactive) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}

type JourneyFieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
};

export function JourneyField({ label, htmlFor, children, hint }: JourneyFieldProps) {
  return (
    <div className="cj-field">
      {label ? (
        <label htmlFor={htmlFor} className="cj-field-label">
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <p className="cj-field-hint">{hint}</p> : null}
    </div>
  );
}

export function JourneyInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete}
      className="cj-input"
    />
  );
}

export function JourneyTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="cj-textarea"
    />
  );
}

export function JourneySelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="cj-select"
    >
      <option value="">{placeholder ?? "Select an option"}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function JourneyHelperBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="cj-helper-box" role="note">
      <p className="cj-helper-box-title">{title}</p>
      <div className="cj-helper-box-body">{children}</div>
    </div>
  );
}

export function JourneyStepHeader({
  stepNumber,
  totalSteps,
  title,
  description,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
}) {
  const titleId = `cj-step-title-${stepNumber}`;

  return (
    <header className="cj-step-header">
      <p className="cj-step-eyebrow" aria-hidden="true">
        Step {stepNumber} of {totalSteps}
      </p>
      <h1 id={titleId} className="cj-step-title">
        {title}
      </h1>
      <p className="cj-step-description">{description}</p>
    </header>
  );
}
