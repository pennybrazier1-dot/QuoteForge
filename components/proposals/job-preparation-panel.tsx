"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  updateJobPrepItemStatus,
  type JobPrepActionState,
} from "@/lib/jobs/actions";
import type { ProposalJobPrepView } from "@/lib/jobs/load-job-for-proposal";
import {
  JOB_PREP_ITEM_DEFINITIONS,
  buildJobPrepActionHref,
  formatJobPrepItemStatus,
  isPrepItemResolved,
} from "@/lib/jobs/prep-items";
import {
  formatJobStatus,
  needsJobPreparation,
} from "@/lib/jobs/status";

const initialState: JobPrepActionState = {};

function PrepStatusMark({ status }: { status: string }) {
  if (status === "confirmed") {
    return <span className="qf-job-prep-mark qf-job-prep-mark-done">✓</span>;
  }
  if (status === "not_needed") {
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
  const definitionByKey = new Map(
    JOB_PREP_ITEM_DEFINITIONS.map((item) => [item.key, item])
  );
  const showPrepBanner = needsJobPreparation(view.job.status);

  return (
    <section className="qf-job-prep" aria-label="Job preparation">
      {showPrepBanner ? (
        <div className="qf-job-prep-banner" role="status">
          <p className="qf-job-prep-banner-title">
            Job accepted — preparation required.
          </p>
          <p className="qf-job-prep-banner-copy">
            Work through the checklist below before scheduling the job.
          </p>
        </div>
      ) : null}

      <div className="qf-job-prep-header">
        <div>
          <h2 className="qf-job-prep-title">Job preparation</h2>
          <p className="qf-job-prep-meta">
            Status: {formatJobStatus(view.job.status)}
          </p>
        </div>
      </div>

      {state.error ? (
        <p className="qf-job-prep-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <ul className="qf-job-prep-list">
        {view.items.map((item) => {
          const definition = definitionByKey.get(item.item_key);
          if (!definition) {
            return null;
          }

          const href = buildJobPrepActionHref(item.item_key, {
            proposalId: view.job.proposal_id,
            customerId: view.job.customer_id,
            enquiryId: view.enquiryId,
          });
          const resolved = isPrepItemResolved(item.status);

          return (
            <li key={item.id} className="qf-job-prep-item">
              <div className="qf-job-prep-item-main">
                <PrepStatusMark status={item.status} />
                <div className="qf-job-prep-item-copy">
                  <p className="qf-job-prep-item-label">{definition.label}</p>
                  <p className="qf-job-prep-item-status">
                    {formatJobPrepItemStatus(item.status)}
                  </p>
                </div>
              </div>

              <div className="qf-job-prep-item-actions">
                {!resolved ? (
                  <Link href={href} className="qf-btn-secondary qf-job-prep-action">
                    {definition.actionLabel}
                  </Link>
                ) : null}

                {!resolved ? (
                  <>
                    <form action={action}>
                      <input type="hidden" name="prepItemId" value={item.id} />
                      <input
                        type="hidden"
                        name="proposalId"
                        value={view.job.proposal_id}
                      />
                      <input type="hidden" name="status" value="confirmed" />
                      <button
                        type="submit"
                        className="qf-btn-primary qf-job-prep-action"
                        disabled={pending}
                      >
                        Confirmed
                      </button>
                    </form>
                    <form action={action}>
                      <input type="hidden" name="prepItemId" value={item.id} />
                      <input
                        type="hidden"
                        name="proposalId"
                        value={view.job.proposal_id}
                      />
                      <input type="hidden" name="status" value="not_needed" />
                      <button
                        type="submit"
                        className="qf-btn-secondary qf-job-prep-action"
                        disabled={pending}
                      >
                        Not needed
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
