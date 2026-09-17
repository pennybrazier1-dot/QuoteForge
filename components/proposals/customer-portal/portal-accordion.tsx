"use client";

import { useId, useState, type ReactNode } from "react";

export function PortalAccordion({
  title,
  preview,
  icon,
  children,
  defaultOpen = false,
  id,
}: {
  title: string;
  preview: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const panelId = id ?? generatedId;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="cj-portal-accordion"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        className="cj-portal-accordion-summary"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="cj-portal-accordion-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="cj-portal-accordion-copy">
          <span className="cj-portal-accordion-title">{title}</span>
          <span className="cj-portal-accordion-preview">{preview}</span>
        </span>
        <span className="cj-portal-accordion-chevron" aria-hidden="true" />
      </summary>
      <div className="cj-portal-accordion-body" id={panelId}>
        {children}
      </div>
    </details>
  );
}
