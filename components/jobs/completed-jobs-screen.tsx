"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatCompletedDateShort,
  groupCompletedJobsByMonth,
  searchCompletedJobs,
  type CompletedJobRecord,
} from "@/lib/jobs/complete-job";
import { formatPaymentStatus } from "@/lib/payments/job-payment";

export function CompletedJobsScreen({
  jobs,
  title = "Completed Jobs",
  subtitle = "A history of finished work, newest first.",
  emptyTitle = "No completed jobs yet",
  emptyBody = "Jobs you mark as complete will appear here.",
}: {
  jobs: CompletedJobRecord[];
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => searchCompletedJobs(jobs, query),
    [jobs, query]
  );
  const groups = useMemo(() => groupCompletedJobsByMonth(visible), [visible]);

  return (
    <div className="qf-trader-page qf-page-simple qf-completed-jobs-page">
      <header className="qf-page-simple-header">
        <h1 className="qf-page-simple-title">{title}</h1>
        <p className="qf-page-simple-subtitle">{subtitle}</p>
      </header>

      {jobs.length > 0 ? (
        <label className="qf-completed-jobs-search">
          <span className="qf-field-label">Search</span>
          <input
            className="form-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Customer, job, address or postcode"
          />
        </label>
      ) : null}

      {jobs.length === 0 ? (
        <div className="qf-visit-empty">
          <h2 className="qf-visit-empty-title">{emptyTitle}</h2>
          <p className="qf-visit-empty-copy">{emptyBody}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="qf-visit-empty">
          <h2 className="qf-visit-empty-title">No matching jobs</h2>
          <p className="qf-visit-empty-copy">
            Try a different customer name, job title or address.
          </p>
        </div>
      ) : (
        <div className="qf-completed-jobs-stack">
          {groups.map((group) => (
            <section key={group.key} className="qf-completed-jobs-month">
              <h2 className="qf-completed-jobs-month-title">{group.heading}</h2>
              <ul className="qf-home-card-list">
                {group.jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/proposals/${job.id}`}
                      className="qf-home-card qf-touch-target"
                    >
                      <div className="qf-home-card-body">
                        <p className="qf-home-card-title">
                          {job.customer_name?.trim() || "Customer"}
                        </p>
                        <p className="qf-home-card-subtitle">
                          {job.title?.trim() || "Completed job"}
                        </p>
                        <p className="qf-completed-jobs-date">
                          {formatPaymentStatus(job.payment_status)}
                        </p>
                        <p className="qf-completed-jobs-address">
                          {formatCompletedDateShort(job.completed_at)}
                        </p>
                        {job.job_address?.trim() ? (
                          <p className="qf-completed-jobs-address">
                            {job.job_address.trim()}
                          </p>
                        ) : null}
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
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
