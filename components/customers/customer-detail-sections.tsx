"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { formatCustomerCreatedAt } from "@/lib/customers/format";
import {
  buildCustomerActivityItems,
  CUSTOMER_DETAIL_SECTIONS,
  customerCurrentWorkMeta,
  customerCurrentWorkTitle,
  customerHistoryWorkTitle,
  customerJobLabel,
  customerProposalLabel,
  customerVisitLabel,
  splitCustomerJobs,
  splitCustomerVisits,
  type CustomerActivityEvent,
  type CustomerDetailJob,
  type CustomerDetailProposal,
  type CustomerDetailSectionId,
  type CustomerDetailVisit,
} from "@/lib/customers/detail-model";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import { getStatusBadgeClass } from "@/lib/proposals/status";

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: CustomerDetailSectionId;
  title: string;
  open: boolean;
  onToggle: (id: CustomerDetailSectionId) => void;
  children: ReactNode;
}) {
  return (
    <section className="qf-customer-detail-section">
      <button
        type="button"
        className="qf-customer-detail-section-trigger"
        aria-expanded={open}
        onClick={() => onToggle(id)}
      >
        <span>{title}</span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="qf-customer-detail-section-body">{children}</div> : null}
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="qf-customer-detail-empty">{children}</p>;
}

export function CustomerDetailSections({
  contact,
  notes,
  jobs,
  proposals,
  visits,
  activity,
}: {
  contact: ReactNode;
  notes?: ReactNode;
  jobs: CustomerDetailJob[];
  proposals: CustomerDetailProposal[];
  visits: CustomerDetailVisit[];
  activity: CustomerActivityEvent[];
}) {
  const [open, setOpen] = useState<Record<CustomerDetailSectionId, boolean>>(
    () =>
      Object.fromEntries(
        CUSTOMER_DETAIL_SECTIONS.map((section) => [section.id, section.defaultOpen])
      ) as Record<CustomerDetailSectionId, boolean>
  );
  const splitJobs = splitCustomerJobs(jobs);
  const splitVisits = splitCustomerVisits(visits);
  const activityItems = buildCustomerActivityItems(activity);

  function toggle(id: CustomerDetailSectionId) {
    setOpen((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="qf-customer-detail-sections">
      <Section
        id="details"
        title="Customer details"
        open={open.details}
        onToggle={toggle}
      >
        {contact}
        {notes}
      </Section>

      <Section
        id="current_work"
        title="Current work"
        open={open.current_work}
        onToggle={toggle}
      >
        {splitJobs.current.length === 0 && splitVisits.current.length === 0 ? (
          <EmptyLine>No current jobs or scheduled visits.</EmptyLine>
        ) : (
          <ul className="qf-customer-detail-list">
            {splitJobs.current.map((job) => (
              <li key={job.id}>
                <Link
                  href={job.proposal_id ? `/proposals/${job.proposal_id}` : "#"}
                  className="qf-customer-detail-item"
                >
                  <p className="qf-customer-detail-item-title">
                    {customerCurrentWorkTitle(job)}
                  </p>
                  <p className="qf-customer-detail-item-meta">
                    {customerCurrentWorkMeta(job)}
                  </p>
                </Link>
              </li>
            ))}
            {splitVisits.current.map((visit) => (
              <li key={visit.id}>
                <Link href={`/visits/${visit.id}`} className="qf-customer-detail-item">
                  <p className="qf-customer-detail-item-title">
                    {customerVisitLabel(visit)}
                  </p>
                  <p className="qf-customer-detail-item-meta">
                    {[visit.visit_date, visit.visit_time, visit.status]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="job_history"
        title="Job history"
        open={open.job_history}
        onToggle={toggle}
      >
        {splitJobs.history.length === 0 ? (
          <EmptyLine>No completed jobs yet.</EmptyLine>
        ) : (
          <ul className="qf-customer-detail-list">
            {splitJobs.history.map((job) => (
              <li key={job.id}>
                <Link
                  href={job.proposal_id ? `/proposals/${job.proposal_id}` : "#"}
                  className="qf-customer-detail-item"
                >
                  <p className="qf-customer-detail-item-title">
                    {customerHistoryWorkTitle(job)}
                  </p>
                  <p className="qf-customer-detail-item-meta">
                    {job.completed_at
                      ? `Completed ${formatCustomerCreatedAt(job.completed_at)}`
                      : customerJobLabel(job.status)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="proposals"
        title="Proposals"
        open={open.proposals}
        onToggle={toggle}
      >
        {proposals.length === 0 ? (
          <EmptyLine>No proposals linked to this customer yet.</EmptyLine>
        ) : (
          <ul className="qf-customer-detail-list">
            {proposals.map((proposal) => (
              <li key={proposal.id}>
                <Link
                  href={`/proposals/${proposal.id}`}
                  className="qf-customer-detail-item"
                >
                  <p className="qf-customer-detail-item-title">
                    {proposal.proposal_number}
                  </p>
                  <p className="qf-customer-detail-item-meta">{proposal.title}</p>
                  <p className="qf-customer-detail-item-meta">
                    {formatPenceAsGbp(proposal.total_amount)} ·{" "}
                    <span className={getStatusBadgeClass(proposal.status)}>
                      {customerProposalLabel(proposal.status)}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="visits" title="Visits" open={open.visits} onToggle={toggle}>
        {visits.length === 0 ? (
          <EmptyLine>No visits linked to this customer yet.</EmptyLine>
        ) : (
          <ul className="qf-customer-detail-list">
            {visits.map((visit) => (
              <li key={visit.id}>
                <Link href={`/visits/${visit.id}`} className="qf-customer-detail-item">
                  <p className="qf-customer-detail-item-title">
                    {customerVisitLabel(visit)}
                  </p>
                  <p className="qf-customer-detail-item-meta">
                    {[visit.visit_date, visit.visit_time, visit.status]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="activity"
        title="Activity history"
        open={open.activity}
        onToggle={toggle}
      >
        {activityItems.length === 0 ? (
          <EmptyLine>No stored cancellations, date changes, or declines yet.</EmptyLine>
        ) : (
          <ul className="qf-customer-detail-list">
            {activityItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="qf-customer-detail-item">
                    <p className="qf-customer-detail-item-title">{item.label}</p>
                    <p className="qf-customer-detail-item-meta">
                      {formatCustomerCreatedAt(item.timestamp)}
                      {item.detail ? ` · ${item.detail}` : ""}
                    </p>
                  </Link>
                ) : (
                  <div className="qf-customer-detail-item">
                    <p className="qf-customer-detail-item-title">{item.label}</p>
                    <p className="qf-customer-detail-item-meta">
                      {formatCustomerCreatedAt(item.timestamp)}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
