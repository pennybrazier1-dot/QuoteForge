import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";
import type { CustomerJourneyPreview } from "@/lib/admin/types";

export function CustomerJourneysPanel({
  journeys,
}: {
  journeys: CustomerJourneyPreview[];
}) {
  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Customer Journeys"
        description="Preview public enquiry flows and review journey notes."
      />

      <AdminSection title="Journey previews">
        <ul className="qf-admin-journey-list">
          {journeys.map((journey) => (
            <li key={journey.id} className="qf-admin-journey-item">
              <div className="qf-admin-journey-head">
                <div>
                  <p className="qf-admin-journey-title">{journey.title}</p>
                  <p className="qf-admin-journey-copy">{journey.description}</p>
                </div>
                <span
                  className={`qf-admin-pill qf-admin-journey-status-${journey.status}`}
                >
                  {journey.status}
                </span>
              </div>
              <p className="qf-admin-journey-notes">{journey.notes}</p>
              <Link
                href={journey.href}
                className="qf-admin-link-card qf-admin-journey-link"
                target="_blank"
              >
                <span className="qf-admin-link-card-url">{journey.href}</span>
                <span className="qf-admin-journey-open">Open preview →</span>
              </Link>
            </li>
          ))}
        </ul>
      </AdminSection>
    </div>
  );
}
