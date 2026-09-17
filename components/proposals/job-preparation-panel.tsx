"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  updateJobPrepItemStatus,
  type JobPrepActionState,
} from "@/lib/jobs/actions";
import type { ProposalJobPrepView } from "@/lib/jobs/load-job-for-proposal";
import {
  buildBookVisitHref,
  buildPrepChecklistRows,
  defaultVisitTypeFromHistory,
  pickRelevantVisit,
  summarizeLinkedVisit,
} from "@/lib/jobs/prep-checklist";

const initialState: JobPrepActionState = {};

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
  const [state, action, pending] = useActionState(
    updateJobPrepItemStatus,
    initialState
  );
  const linkedVisit = pickRelevantVisit(view.visits);
  const rows = buildPrepChecklistRows({
    items: view.items,
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

  return (
    <section className="qf-job-prep" aria-label="Job preparation">
      <div className="qf-job-prep-header">
        <h2 className="qf-job-prep-title">Job preparation</h2>
      </div>

      {state.error ? (
        <p className="qf-job-prep-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <ul className="qf-job-prep-list">
        {rows.map((row) => (
          <li key={row.key} className="qf-job-prep-item">
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
                    <form action={action}>
                      <input type="hidden" name="prepItemId" value={row.itemId} />
                      <input
                        type="hidden"
                        name="proposalId"
                        value={view.job.proposal_id}
                      />
                      <input type="hidden" name="status" value="confirmed" />
                      <button
                        type="submit"
                        className="qf-job-prep-more-action"
                        disabled={pending}
                      >
                        Mark confirmed
                      </button>
                    </form>
                    <form action={action}>
                      <input type="hidden" name="prepItemId" value={row.itemId} />
                      <input
                        type="hidden"
                        name="proposalId"
                        value={view.job.proposal_id}
                      />
                      <input type="hidden" name="status" value="not_needed" />
                      <button
                        type="submit"
                        className="qf-job-prep-more-action"
                        disabled={pending}
                      >
                        Mark not needed
                      </button>
                    </form>
                  </div>
                </details>
              ) : null}
            </div>
          </li>
        ))}
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
