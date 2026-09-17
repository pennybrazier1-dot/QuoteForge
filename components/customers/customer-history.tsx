import type { ReactNode } from "react";
import Link from "next/link";
import { formatCustomerCreatedAt } from "@/lib/customers/format";
import { formatJobStatus } from "@/lib/jobs/status";
import { formatVisitType } from "@/lib/visits/types";
import { SectionCard } from "@/components/ui/section-card";

export type CustomerJobItem = {
  id: string;
  status: string;
  accepted_at: string | null;
  proposal_id: string | null;
};

export type CustomerVisitItem = {
  id: string;
  visit_date: string | null;
  visit_time: string | null;
  status: string;
  visit_type: string | null;
};

function HistoryList<T extends { id: string }>({
  title,
  empty,
  items,
  href,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  href: (item: T) => string;
  render: (item: T) => ReactNode;
}) {
  return (
    <SectionCard>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {items.length > 0 ? (
          <span className="text-xs text-muted">{items.length} saved</span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="qf-card-inset mt-6 border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted">{empty}</p>
        </div>
      ) : (
        <ul className="qf-list mt-6">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={href(item)} className="group qf-card-inset block">
                {render(item)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function CustomerJobs({ jobs }: { jobs: CustomerJobItem[] }) {
  return (
    <HistoryList
      title="Jobs"
      empty="No jobs linked to this customer yet."
      items={jobs}
      href={(job) =>
        job.proposal_id ? `/proposals/${job.proposal_id}` : "/customers"
      }
      render={(job) => (
        <>
          <p className="text-sm font-semibold">{formatJobStatus(job.status)}</p>
          <p className="mt-1 text-xs text-muted">
            {job.accepted_at
              ? `Accepted ${formatCustomerCreatedAt(job.accepted_at)}`
              : "Linked job"}
          </p>
        </>
      )}
    />
  );
}

export function CustomerVisits({ visits }: { visits: CustomerVisitItem[] }) {
  return (
    <HistoryList
      title="Visits"
      empty="No visits linked to this customer yet."
      items={visits}
      href={(visit) => `/visits/${visit.id}`}
      render={(visit) => (
        <>
          <p className="text-sm font-semibold">
            {visit.visit_type ? formatVisitType(visit.visit_type) : "Visit"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {[visit.visit_date, visit.visit_time, visit.status]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </>
      )}
    />
  );
}
