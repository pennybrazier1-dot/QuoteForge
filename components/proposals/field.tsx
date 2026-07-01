export function ProposalField({
  label,
  id,
  name,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required = false,
}: {
  label: string;
  id: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="form-input mt-2"
      />
    </div>
  );
}

export function ProposalTextarea({
  label,
  id,
  name,
  value,
  onChange,
  rows = 6,
  placeholder,
  required = false,
}: {
  label: string;
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
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
        placeholder={placeholder}
        required={required}
        className="form-textarea mt-2"
      />
    </div>
  );
}
