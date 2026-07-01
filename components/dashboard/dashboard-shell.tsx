import type { ReactNode } from "react";
import { formatDashboardDateRange } from "@/lib/dashboard/metrics";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="qf-dash">
      <header className="qf-dash-header">
        <div>
          <h1 className="qf-dash-title">Dashboard</h1>
          <p className="qf-dash-subtitle">
            Overview of your proposals and business.
          </p>
        </div>

        <button type="button" className="qf-dash-date">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>{formatDashboardDateRange()}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </header>

      <div className="qf-dash-stack">{children}</div>
    </div>
  );
}

function Sparkline({
  values,
  tone,
}: {
  values: number[];
  tone: "accent" | "emerald" | "amber" | "red";
}) {
  const width = 120;
  const height = 28;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`qf-dash-sparkline qf-dash-sparkline-${tone}`}
      aria-hidden="true"
    >
      <polyline points={points} fill="none" strokeWidth="2" />
    </svg>
  );
}

export function StatCardsRow({
  metrics,
  trends,
}: {
  metrics: {
    total: number;
    accepted: number;
    readyToSend: number;
    declined: number;
  };
  trends: {
    total: { label: string; direction: string; sparkline: number[] };
    accepted: { label: string; direction: string; sparkline: number[] };
    readyToSend: { label: string; direction: string; sparkline: number[] };
    declined: { label: string; direction: string; sparkline: number[] };
  };
}) {
  const cards = [
    {
      label: "Total Proposals",
      value: metrics.total,
      trend: trends.total,
      tone: "accent" as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
      ),
    },
    {
      label: "Accepted",
      value: metrics.accepted,
      trend: trends.accepted,
      tone: "emerald" as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
    },
    {
      label: "Ready to Send",
      value: metrics.readyToSend,
      trend: trends.readyToSend,
      tone: "amber" as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      label: "Declined",
      value: metrics.declined,
      trend: trends.declined,
      tone: "red" as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="qf-dash-stat-row">
      {cards.map((card) => (
        <article key={card.label} className="qf-dash-card qf-dash-stat-card">
          <div className="qf-dash-stat-top">
            <span className={`qf-dash-stat-icon qf-dash-stat-icon-${card.tone}`}>
              {card.icon}
            </span>
            <p className="qf-dash-stat-label">{card.label}</p>
          </div>
          <p className="qf-dash-stat-value">{card.value.toLocaleString()}</p>
          <p
            className={`qf-dash-stat-trend ${
              card.trend.direction === "up"
                ? "qf-dash-stat-trend-up"
                : card.trend.direction === "down"
                  ? "qf-dash-stat-trend-down"
                  : ""
            }`}
          >
            {card.trend.label}
          </p>
          <Sparkline values={card.trend.sparkline} tone={card.tone} />
        </article>
      ))}
    </div>
  );
}
