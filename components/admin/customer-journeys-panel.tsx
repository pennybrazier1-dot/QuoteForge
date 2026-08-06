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
        title="Customer journey demos"
        description="Testing-only previews of the public customer quote forms. Traders should share their Settings link instead."
      />

      <AdminSection title="Demo previews">
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
                <span className="qf-admin-journey-open">Open customer demo →</span>
              </Link>
            </li>
          ))}
        </ul>
      </AdminSection>
    </div>
  );
}
