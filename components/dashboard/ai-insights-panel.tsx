import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardInsight } from "@/lib/dashboard/insights";

const TONE_CLASS: Record<DashboardInsight["tone"], string> = {
  emerald: "qf-dash-insight-icon-emerald",
  amber: "qf-dash-insight-icon-amber",
  blue: "qf-dash-insight-icon-blue",
  purple: "qf-dash-insight-icon-purple",
};

const INSIGHT_ICONS: Record<DashboardInsight["tone"], ReactNode> = {
  emerald: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  amber: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
    </svg>
  ),
  blue: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  purple: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export function AiInsightsPanel({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section className="qf-dash-card qf-dash-panel">
      <div className="qf-dash-panel-header">
        <div className="qf-dash-section-heading">
          <span className="qf-dash-section-icon qf-dash-insight-icon-accent" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.9 5.8H4l4.9 3.6-1.9 5.8L12 14.6l5 3.8-1.9-5.8L20 8.8h-6.1L12 3z" />
            </svg>
          </span>
          <h2 className="qf-dash-section-title">AI Insights</h2>
        </div>
        <Link href="/proposals" className="qf-dash-link">
          View all insights
        </Link>
      </div>

      <div className="qf-dash-insights-grid">
        {insights.map((insight) => (
          <Link
            key={insight.id}
            href={insight.href}
            className="qf-dash-insight-card"
          >
            <span className={`qf-dash-insight-icon ${TONE_CLASS[insight.tone]}`}>
              {INSIGHT_ICONS[insight.tone]}
            </span>
            <div className="min-w-0">
              <p className="qf-dash-insight-title">{insight.title}</p>
              <p className="qf-dash-insight-copy">{insight.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
