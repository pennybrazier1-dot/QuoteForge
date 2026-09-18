"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { updateJobPrepItemStatus } from "@/lib/jobs/actions";
import type { ProposalJobPrepView } from "@/lib/jobs/load-job-for-proposal";
import {
  applyPrepStatusOverrides,
  beginPrepStatusUpdate,
  canQueuePrepUpdate,
  completePrepStatusUpdate,
  emptyOptimisticPrepState,
  failPrepStatusUpdate,
  isPrepRowPending,
} from "@/lib/jobs/optimistic-prep";
import {
  buildBookVisitHref,
  buildPrepChecklistRows,
  defaultVisitTypeFromHistory,
  pickRelevantVisit,
  summarizeLinkedVisit,
} from "@/lib/jobs/prep-checklist";
import type { JobPrepItemStatus } from "@/lib/jobs/prep-items";

function PrepStatusMark({ tone }: { tone: "done" | "open" | "skip" }) {
  if (tone === "done") {
    return <span className="qf-job-prep-mark qf-job-prep-mark-done">✓</span>;
  }
  if (tone === "skip") {
    return <span className="qf-job-prep-mark qf-job-prep-mark-skip">–</span>;
  }
  return <span className="qf-job-prep-mark qf-job-prep-mark-open">○</span>;
}

export function JobPreparationPanel({
  view,
}: {
  view: ProposalJobPrepView;
}) {
  const [opt, setOpt] = useState(emptyOptimisticPrepState);
  const optRef = useRef(opt);

  function setOptimistic(next: typeof opt) {
    optRef.current = next;
    setOpt(next);
  }

  const linkedVisit = pickRelevantVisit(view.visits);
  const rows = buildPrepChecklistRows({
    items: applyPrepStatusOverrides(view.items, opt.overrides),
    linkedVisit,
  });
  const visitSummary = summarizeLinkedVisit(linkedVisit);
  const siteVisitRow = rows.find((row) => row.key === "site_visit");
  const showBookVisit =
    siteVisitRow?.statusLabel === "Not booked" && !visitSummary;
  const bookVisitHref = buildBookVisitHref({
    proposalId: view.job.proposal_id,
    customerId: view.job.customer_id,
    enquiryId: view.enquiryId,
    visitType: defaultVisitTypeFromHistory(view.visits),
  });

  function persistStatus(itemId: string, status: JobPrepItemStatus) {
    if (!canQueuePrepUpdate(optRef.current, itemId)) {
      return;
    }

    setOptimistic(beginPrepStatusUpdate(optRef.current, itemId, status));

    const formData = new FormData();
    formData.set("prepItemId", itemId);
    formData.set("proposalId", view.job.proposal_id);
    formData.set("status", status);

    void updateJobPrepItemStatus({}, formData)
      .then((result) => {
        setOptimistic(
          result.ok
            ? completePrepStatusUpdate(optRef.current, itemId)
            : failPrepStatusUpdate(optRef.current, itemId)
        );
      })
      .catch(() => {
        setOptimistic(failPrepStatusUpdate(optRef.current, itemId));
      });
  }

  return (
    <section className="qf-job-prep" aria-label="Job preparation">
      <div className="qf-job-prep-header">
        <h2 className="qf-job-prep-title">Job preparation</h2>
      </div>

      {opt.error ? (
        <p className="qf-job-prep-error" role="alert">
          {opt.error}
        </p>
      ) : null}

      <ul className="qf-job-prep-list">
        {rows.map((row) => {
          const rowPending = isPrepRowPending(opt.pendingIds, row.itemId);
          return (
            <li
              key={row.key}
              className={
                rowPending
                  ? "qf-job-prep-item qf-job-prep-item-saving"
                  : "qf-job-prep-item"
              }
            >
              <div className="qf-job-prep-item-main">
                <PrepStatusMark tone={row.tone} />
                <div className="qf-job-prep-item-copy">
                  <p className="qf-job-prep-item-label">{row.label}</p>
                  <p className="qf-job-prep-item-status">{row.statusLabel}</p>
                  {row.detail ? (
                    <p className="qf-job-prep-item-detail">{row.detail}</p>
                  ) : null}
                </div>
              </div>

              <div className="qf-job-prep-item-side">
                {row.key === "site_visit" && visitSummary ? (
                  <Link
                    href={`/visits/${visitSummary.id}`}
                    className="qf-btn-secondary qf-job-prep-action"
                  >
                    View visit
                  </Link>
                ) : null}

                {row.showMoreMenu ? (
                  <details className="qf-job-prep-more">
                    <summary className="qf-job-prep-more-trigger">
                      <span className="qf-job-prep-more-label">
                        More actions for {row.label}
                      </span>
                      <span aria-hidden="true">⋯</span>
                    </summary>
                    <div className="qf-job-prep-more-menu">
                      <button
                        type="button"
                        className="qf-job-prep-more-action"
                        disabled={rowPending}
                        onClick={() => persistStatus(row.itemId, "confirmed")}
                      >
                        Mark confirmed
                      </button>
                      <button
                        type="button"
                        className="qf-job-prep-more-action"
                        disabled={rowPending}
                        onClick={() => persistStatus(row.itemId, "not_needed")}
                      >
                        Mark not needed
                      </button>
                    </div>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {showBookVisit ? (
        <div className="qf-job-prep-footer">
          <Link href={bookVisitHref} className="qf-btn-primary qf-job-prep-book">
            Book visit
          </Link>
        </div>
      ) : null}
    </section>
  );
}
