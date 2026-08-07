import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JOB_PREP_ITEM_DEFINITIONS,
  type JobPrepItemKey,
  type JobPrepItemStatus,
} from "@/lib/jobs/prep-items";
import type { JobStatus } from "@/lib/jobs/status";

export type JobRecord = {
  id: string;
  workspace_id: string;
  proposal_id: string;
  customer_id: string | null;
  status: JobStatus;
  accepted_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type JobPrepItemRecord = {
  id: string;
  job_id: string;
  item_key: JobPrepItemKey;
  status: JobPrepItemStatus;
  sort_order: number;
  confirmed_at: string | null;
};

export type ProposalJobPrepView = {
  job: JobRecord;
  items: JobPrepItemRecord[];
  enquiryId: string | null;
};

export async function loadJobPrepForProposal(
  supabase: SupabaseClient,
  proposalId: string
): Promise<ProposalJobPrepView | null> {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(
      "id, workspace_id, proposal_id, customer_id, status, accepted_at, started_at, completed_at"
    )
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (jobError || !job) {
    return null;
  }

  const [{ data: items }, { data: enquiry }] = await Promise.all([
    supabase
      .from("job_prep_items")
      .select("id, job_id, item_key, status, sort_order, confirmed_at")
      .eq("job_id", job.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("enquiries")
      .select("id")
      .eq("linked_proposal_id", proposalId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const byKey = new Map(
    (items ?? []).map((item) => [item.item_key as JobPrepItemKey, item])
  );

  const ordered: JobPrepItemRecord[] = JOB_PREP_ITEM_DEFINITIONS.map(
    (definition) => {
      const row = byKey.get(definition.key);
      if (row) {
        return {
          id: row.id,
          job_id: row.job_id,
          item_key: row.item_key as JobPrepItemKey,
          status: row.status as JobPrepItemStatus,
          sort_order: row.sort_order,
          confirmed_at: row.confirmed_at,
        };
      }
      return {
        id: `${job.id}-${definition.key}`,
        job_id: job.id,
        item_key: definition.key,
        status: "open",
        sort_order: definition.sortOrder,
        confirmed_at: null,
      };
    }
  );

  return {
    job: {
      id: job.id,
      workspace_id: job.workspace_id,
      proposal_id: job.proposal_id,
      customer_id: job.customer_id,
      status: job.status as JobStatus,
      accepted_at: job.accepted_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    },
    items: ordered,
    enquiryId: enquiry?.id ?? null,
  };
}
