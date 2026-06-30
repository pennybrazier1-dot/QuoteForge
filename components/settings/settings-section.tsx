import type { ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

export function SettingsField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border-subtle bg-background p-4 ${className}`}
    >
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm text-foreground/90">
        {value?.trim() ? value : <span className="text-muted">Not set</span>}
      </dd>
    </div>
  );
}
