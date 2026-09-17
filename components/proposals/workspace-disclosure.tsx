"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { defaultWorkspaceDisclosureOpen } from "@/lib/proposals/waiting-page-layout";

export function WorkspaceDisclosure({
  title,
  children,
  id,
  badge,
}: {
  title: string;
  children: ReactNode;
  id?: string;
  badge?: string | null;
}) {
  const generatedId = useId();
  const panelId = id ?? generatedId;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setOpen(defaultWorkspaceDisclosureOpen(media.matches ? "desktop" : "mobile"));
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <details
      className="qf-workspace-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="qf-workspace-disclosure-summary">
        <span>{title}</span>
        {badge ? (
          <span className="qf-workspace-disclosure-badge">{badge}</span>
        ) : null}
      </summary>
      <div className="qf-workspace-disclosure-body" id={panelId}>
        {children}
      </div>
    </details>
  );
}
