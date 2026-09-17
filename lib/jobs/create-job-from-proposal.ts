import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureActiveCustomerForAcceptedWork } from "@/lib/customers/ensure-active-customer";
import {
  JOB_PREP_ITEM_DEFINITIONS,
  type JobPrepItemKey,
  type JobPrepItemStatus,
} from "@/lib/jobs/prep-items";
import type { JobStatus } from "@/lib/jobs/status";

export type ProposalJobSeed = {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  job_address: string | null;
  planned_start_date: string | null;
  booking_confirmation?: string | null;
  accepted_at?: string | null;
  status?: string | null;
  materials: unknown;
};

export type CreatedJobRecord = {
  id: string;
  workspace_id: string;
  proposal_id: string;
  customer_id: string | null;
  status: JobStatus;
  accepted_at: string;
};

function hasCustomerDetails(proposal: ProposalJobSeed): boolean {
  const hasName = Boolean(proposal.customer_name?.trim());
  const hasContact = Boolean(
    proposal.customer_email?.trim() || proposal.customer_phone?.trim()
  );
  const hasAddress = Boolean(
    proposal.customer_address?.trim() || proposal.job_address?.trim()
  );
  return hasName && hasContact && hasAddress;
}

function hasMaterialsListed(materials: unknown): boolean {
  if (Array.isArray(materials)) {
    return materials.some(
      (item) => typeof item === "string" && item.trim().length > 0
    );
  }
  if (typeof materials === "string") {
    return materials.trim().length > 0;
  }
  return false;
}

export function resolveInitialPrepStatus(
  key: JobPrepItemKey,
  proposal: ProposalJobSeed
): JobPrepItemStatus {
  switch (key) {
    case "customer_details":
      return hasCustomerDetails(proposal) ? "confirmed" : "open";
    case "materials":
      return hasMaterialsListed(proposal.materials) ? "open" : "open";
    case "start_date":
      return proposal.planned_start_date ? "open" : "open";
    default:
      return "open";
  }
}

export function buildDefaultPrepItemRows(
  workspaceId: string,
  jobId: string,
  proposal: ProposalJobSeed,
  acceptedAt: string
) {
  return JOB_PREP_ITEM_DEFINITIONS.map((definition) => {
    const status = resolveInitialPrepStatus(definition.key, proposal);
    return {
      workspace_id: workspaceId,
      job_id: jobId,
      item_key: definition.key,
      status,
      sort_order: definition.sortOrder,
      confirmed_at: status === "confirmed" ? acceptedAt : null,
    };
  });
}

/**
 * Create a job for an accepted proposal, or return the existing one.
 * Idempotent on proposal_id.
 */
export async function ensureJobForAcceptedProposal(
  supabase: SupabaseClient,
  proposal: ProposalJobSeed,
  options?: { acceptedAt?: string }
): Promise<
  | { ok: true; job: CreatedJobRecord; created: boolean }
  | { ok: false; error: string }
> {
  const acceptedAt = options?.acceptedAt ?? new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("jobs")
    .select("id, workspace_id, proposal_id, customer_id, status, accepted_at")
    .eq("proposal_id", proposal.id)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message || "Could not load job.", ok: false };
  }

  if (existing) {
    const customerId = await linkAcceptedWorkCustomer(
      supabase,
      proposal,
      existing.id
    );
    return {
      ok: true,
      created: false,
      job: {
        id: existing.id,
        workspace_id: existing.workspace_id,
        proposal_id: existing.proposal_id,
        customer_id: customerId ?? existing.customer_id,
        status: existing.status as JobStatus,
        accepted_at: existing.accepted_at,
      },
    };
  }

  const { data: created, error: createError } = await supabase
    .from("jobs")
    .insert({
      workspace_id: proposal.workspace_id,
      proposal_id: proposal.id,
      customer_id: proposal.customer_id,
      status: "accepted",
      accepted_at: acceptedAt,
    })
    .select("id, workspace_id, proposal_id, customer_id, status, accepted_at")
    .single();

  if (createError || !created) {
    // Race: another accept path may have created it.
    if (createError?.code === "23505") {
      const { data: raced } = await supabase
        .from("jobs")
        .select("id, workspace_id, proposal_id, customer_id, status, accepted_at")
        .eq("proposal_id", proposal.id)
        .maybeSingle();
      if (raced) {
        const customerId = await linkAcceptedWorkCustomer(
          supabase,
          proposal,
          raced.id
        );
        return {
          ok: true,
          created: false,
          job: {
            id: raced.id,
            workspace_id: raced.workspace_id,
            proposal_id: raced.proposal_id,
            customer_id: customerId ?? raced.customer_id,
            status: raced.status as JobStatus,
            accepted_at: raced.accepted_at,
          },
        };
      }
    }
    return {
      ok: false,
      error: createError?.message || "Could not create job.",
    };
  }

  const prepRows = buildDefaultPrepItemRows(
    proposal.workspace_id,
    created.id,
    proposal,
    acceptedAt
  );

  const { error: prepError } = await supabase
    .from("job_prep_items")
    .insert(prepRows);

  if (prepError) {
    return {
      ok: false,
      error: prepError.message || "Could not create job preparation items.",
    };
  }

  const customerId = await linkAcceptedWorkCustomer(
    supabase,
    proposal,
    created.id
  );

  return {
    ok: true,
    created: true,
    job: {
      id: created.id,
      workspace_id: created.workspace_id,
      proposal_id: created.proposal_id,
      customer_id: customerId ?? created.customer_id,
      status: created.status as JobStatus,
      accepted_at: created.accepted_at,
    },
  };
}

async function linkAcceptedWorkCustomer(
  supabase: SupabaseClient,
  proposal: ProposalJobSeed,
  jobId: string
): Promise<string | null> {
  const result = await ensureActiveCustomerForAcceptedWork(supabase, {
    workspaceId: proposal.workspace_id,
    proposalId: proposal.id,
    jobId,
    existingCustomerId: proposal.customer_id,
    source: {
      name: proposal.customer_name,
      email: proposal.customer_email,
      phone: proposal.customer_phone,
      address: proposal.customer_address || proposal.job_address,
    },
    proposalAccepted: true,
    jobCreatedOrActivated: true,
    bookingConfirmed: proposal.booking_confirmation === "confirmed",
  });

  if (!result.ok || result.skipped) {
    return proposal.customer_id;
  }

  return result.customerId;
}
