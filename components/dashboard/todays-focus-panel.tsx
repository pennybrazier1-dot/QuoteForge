import Link from "next/link";
import type { ReactNode } from "react";
import type { FocusRow } from "@/lib/dashboard/metrics";

const TONE_CLASS: Record<FocusRow["tone"], string> = {
  accent: "qf-dash-focus-icon-accent",
  amber: "qf-dash-focus-icon-amber",
  blue: "qf-dash-focus-icon-blue",
  emerald: "qf-dash-focus-icon-emerald",
  purple: "qf-dash-focus-icon-purple",
};

const FOCUS_ICONS: Record<FocusRow["tone"], ReactNode> = {
  accent: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  amber: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  blue: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  emerald: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  purple: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

export function TodaysFocusPanel({ rows }: { rows: FocusRow[] }) {
  return (
    <section className="qf-dash-card qf-dash-panel">
      <div className="qf-dash-panel-header">
        <div className="qf-dash-section-heading">
          <span className="qf-dash-section-icon qf-dash-focus-icon-blue" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <h2 className="qf-dash-section-title">Today&apos;s Focus</h2>
        </div>
      </div>

      <ul className="qf-dash-focus-list">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={row.href} className="qf-dash-focus-row">
              <span className={`qf-dash-focus-icon ${TONE_CLASS[row.tone]}`}>
                {FOCUS_ICONS[row.tone]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="qf-dash-row-title">{row.title}</p>
                <p className="qf-dash-row-subtitle">{row.subtitle}</p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="qf-dash-chevron"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
