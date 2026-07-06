import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/section-card";

export function AdminSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <SectionCard className={`qf-admin-section ${className}`.trim()}>
      <h2 className="qf-admin-section-title">{title}</h2>
      {description ? (
        <p className="qf-admin-section-description">{description}</p>
      ) : null}
      {children}
    </SectionCard>
  );
}
