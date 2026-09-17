import type { SupabaseClient } from "@supabase/supabase-js";
import {
  planEnsureActiveCustomer,
  type EnsureCustomerSource,
} from "@/lib/customers/lifecycle";

export type EnsureActiveCustomerInput = {
  workspaceId: string;
  proposalId: string;
  jobId?: string | null;
  existingCustomerId?: string | null;
  source: EnsureCustomerSource;
  proposalAccepted: boolean;
  jobCreatedOrActivated: boolean;
  bookingConfirmed: boolean;
  nowIso?: string;
};

export type EnsureActiveCustomerResult =
  | { ok: true; skipped: true; customerId: string | null }
  | { ok: true; skipped: false; customerId: string; created: boolean }
  | { ok: false; error: string };

type CustomerRow = {
  id: string;
  workspace_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  activated_at: string | null;
  anonymised_at: string | null;
};

async function loadWorkspaceCustomers(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, workspace_id, name, email, phone, address_line_1, activated_at, anonymised_at"
    )
    .eq("workspace_id", workspaceId);

  if (error || !data) {
    return [];
  }

  return data as CustomerRow[];
}

async function linkCustomerRecords(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    proposalId: string;
    jobId?: string | null;
    customerId: string;
  }
) {
  await supabase
    .from("proposals")
    .update({ customer_id: input.customerId })
    .eq("id", input.proposalId)
    .eq("workspace_id", input.workspaceId);

  if (input.jobId) {
    await supabase
      .from("jobs")
      .update({ customer_id: input.customerId })
      .eq("id", input.jobId)
      .eq("workspace_id", input.workspaceId);
  }
}

export async function ensureActiveCustomerForAcceptedWork(
  supabase: SupabaseClient,
  input: EnsureActiveCustomerInput
): Promise<EnsureActiveCustomerResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const candidates = await loadWorkspaceCustomers(supabase, input.workspaceId);
  const plan = planEnsureActiveCustomer({
    workspaceId: input.workspaceId,
    existingCustomerId: input.existingCustomerId,
    source: input.source,
    candidates,
    proposalAccepted: input.proposalAccepted,
    jobCreatedOrActivated: input.jobCreatedOrActivated,
    bookingConfirmed: input.bookingConfirmed,
    nowIso,
  });

  if (!plan.triggered) {
    return { ok: true, skipped: true, customerId: plan.customerId };
  }

  let customerId = plan.customerId;
  let created = false;

  if (plan.shouldCreate || !customerId) {
    const { data: createdCustomer, error: createError } = await supabase
      .from("customers")
      .insert({
        workspace_id: input.workspaceId,
        ...plan.activatePatch,
      })
      .select("id")
      .single();

    if (createError || !createdCustomer) {
      return {
        ok: false,
        error: createError?.message || "Could not create this customer.",
      };
    }

    customerId = createdCustomer.id as string;
    created = true;
  } else {
    const existing = candidates.find((candidate) => candidate.id === customerId);
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        activated_at: existing?.activated_at ?? nowIso,
        archived_at: null,
        deletion_requested_at: null,
        deletion_scheduled_for: null,
        name: plan.activatePatch.name || existing?.name || "Customer",
        email: plan.activatePatch.email || existing?.email || null,
        phone: plan.activatePatch.phone || existing?.phone || null,
        address_line_1:
          plan.activatePatch.address_line_1 || existing?.address_line_1 || null,
      })
      .eq("id", customerId)
      .eq("workspace_id", input.workspaceId);

    if (updateError) {
      return {
        ok: false,
        error: updateError.message || "Could not update this customer.",
      };
    }
  }

  await linkCustomerRecords(supabase, {
    workspaceId: input.workspaceId,
    proposalId: input.proposalId,
    jobId: input.jobId,
    customerId,
  });

  return { ok: true, skipped: false, customerId, created };
}
