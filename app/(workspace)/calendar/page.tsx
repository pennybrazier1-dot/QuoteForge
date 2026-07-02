import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Calendar — QuoteForge",
  description: "Your jobs and schedule.",
};

export default function CalendarPage() {
  return (
    <div className="qf-page-simple">
      <header className="qf-page-simple-header">
        <h1 className="qf-page-simple-title">Calendar</h1>
        <p className="qf-page-simple-subtitle">
          Your schedule will appear here. For now, check Today&apos;s Jobs on Home.
        </p>
      </header>

      <Link href="/dashboard" className="qf-home-card qf-touch-target">
        <div className="qf-home-card-body">
          <p className="qf-home-card-title">Go to Home</p>
          <p className="qf-home-card-subtitle">See what you need to do today</p>
        </div>
        <span className="qf-home-card-chevron" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </Link>
    </div>
  );
}
