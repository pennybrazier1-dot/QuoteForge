const fieldClassName =
  "mt-2 w-full rounded-lg border border-border-subtle bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/20";

export function OnboardingField({
  label,
  id,
  type = "text",
  name,
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder,
}: {
  label: string;
  id: string;
  type?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {!required ? (
          <span className="ml-1 text-xs font-normal text-muted">(optional)</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className={fieldClassName}
      />
    </div>
  );
}

export function OnboardingSelect({
  label,
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = true,
}: {
  label: string;
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className={fieldClassName}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function OnboardingTextarea({
  label,
  id,
  name,
  value,
  onChange,
  rows = 3,
  required = true,
}: {
  label: string;
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        required={required}
        className={`${fieldClassName} resize-y`}
      />
    </div>
  );
}
