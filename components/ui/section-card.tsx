import type { ElementType, ReactNode } from "react";

type SectionCardVariant = "default" | "inset" | "accent";

const variantClasses: Record<SectionCardVariant, string> = {
  default: "qf-card",
  inset: "qf-card-inset",
  accent: "qf-card-accent",
};

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  variant?: SectionCardVariant;
  as?: ElementType;
};

export function SectionCard({
  children,
  className = "",
  variant = "default",
  as: Component = "section",
}: SectionCardProps) {
  return (
    <Component className={`${variantClasses[variant]} ${className}`.trim()}>
      {children}
    </Component>
  );
}

export function SectionStack({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`qf-stack ${className}`.trim()}>{children}</div>;
}

/** Shared card shell for dashboard lists and panels. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SectionCard as="div" className={className}>
      {children}
    </SectionCard>
  );
}

export function CardHeading({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}
