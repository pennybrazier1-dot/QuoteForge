import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import { listVisits } from "@/lib/visits/queries";
import {
  formatVisitDateLabel,
  formatVisitDuration,
  formatVisitStatus,
  formatVisitTimeLabel,
  formatVisitType,
} from "@/lib/visits/types";

export const metadata: Metadata = {
  title: "Visits",
  description: "Book and manage site assessment visits before a quote.",
};

export default async function VisitsPage() {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    redirect("/login");
  }

  const visits = await listVisits(context.supabase, context.workspaceId);

  return (
    <main className="qf-visit-page">
      <header className="qf-visit-page-header">
        <div>
          <h1 className="qf-visit-page-title">Visits</h1>
          <p className="qf-visit-page-subtitle">
            Arrange and manage site visits before or during jobs.
          </p>
        </div>
        <Link href="/visits/new" className="qf-btn-primary">
          Book visit
        </Link>
      </header>

      {visits.length === 0 ? (
        <div className="qf-visit-empty">
          <h2 className="qf-visit-empty-title">No visits scheduled yet.</h2>
          <p className="qf-visit-empty-copy">Book a visit from:</p>
          <ul className="qf-visit-empty-list">
            <li>customer</li>
            <li>enquiry</li>
            <li>calendar</li>
          </ul>
          <p className="qf-visit-empty-copy">No quote or job is required.</p>
        </div>
      ) : (
        <ul className="qf-visit-list">
          {visits.map((visit) => {
            const timeLabel = formatVisitTimeLabel(visit.visit_time);
            return (
              <li key={visit.id}>
                <Link href={`/visits/${visit.id}`} className="qf-visit-list-card">
                  <div className="qf-visit-list-card-top">
                    <p className="qf-visit-list-card-title">
                      {visit.customer_name}
                    </p>
                    <span
                      className={`qf-visit-status qf-visit-status-${visit.status}`}
                    >
                      {formatVisitStatus(visit.status)}
                    </span>
                  </div>
                  <p className="qf-visit-list-card-meta">
                    {formatVisitType(visit.visit_type)}
                  </p>
                  <p className="qf-visit-list-card-meta">
                    {[
                      formatVisitDateLabel(visit.visit_date),
                      timeLabel,
                      formatVisitDuration(visit.duration_minutes),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
