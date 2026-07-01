import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/section-card";

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
    <SectionCard>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted">{description}</p>
      ) : null}
      {children}
    </SectionCard>
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
    <SectionCard as="div" variant="inset" className={className}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm text-foreground/90">
        {value?.trim() ? value : <span className="text-muted">Not set</span>}
      </dd>
    </SectionCard>
  );
}
