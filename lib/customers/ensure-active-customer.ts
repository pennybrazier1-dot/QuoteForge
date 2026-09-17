import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mergeCustomerContactSources,
  shouldPreserveCustomerLifecycle,
} from "@/lib/customers/activation";
import {
  emailsMatch,
  phonesMatch,
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
  archived_at: string | null;
  deletion_requested_at: string | null;
  anonymised_at: string | null;
};

type LinkedVisitRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
};

type LinkedEnquiryRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_mobile: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
};

function formatAddress(parts: Array<string | null | undefined>): string | null {
  const joined = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
  return joined || null;
}

async function loadWorkspaceCustomers(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, workspace_id, name, email, phone, address_line_1, activated_at, archived_at, deletion_requested_at, anonymised_at"
    )
    .eq("workspace_id", workspaceId);

  if (error || !data) {
    return [];
  }

  return data as CustomerRow[];
}

async function loadLinkedEnquiry(
  supabase: SupabaseClient,
  proposalId: string
): Promise<LinkedEnquiryRow | null> {
  const { data } = await supabase
    .from("enquiries")
    .select(
      "id, customer_id, customer_name, customer_email, customer_mobile, address_line_1, address_line_2, town, county, postcode"
    )
    .eq("linked_proposal_id", proposalId)
    .maybeSingle();
  return (data as LinkedEnquiryRow | null) ?? null;
}

async function loadLinkedVisits(
  supabase: SupabaseClient,
  workspaceId: string,
  proposalId: string,
  existingCustomerId?: string | null
): Promise<LinkedVisitRow[]> {
  const { data } = await supabase
    .from("visits")
    .select(
      "id, customer_id, customer_name, contact_email, contact_phone, address_line_1, address_line_2, town, county, postcode"
    )
    .eq("workspace_id", workspaceId)
    .or(
      [
        `linked_proposal_id.eq.${proposalId}`,
        existingCustomerId ? `customer_id.eq.${existingCustomerId}` : null,
      ]
        .filter(Boolean)
        .join(",")
    );

  return (data as LinkedVisitRow[] | null) ?? [];
}

async function linkCustomerRecords(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    proposalId: string;
    jobId?: string | null;
    customerId: string;
    email?: string | null;
    phone?: string | null;
  }
) {
  await supabase
    .from("proposals")
    .update({ customer_id: input.customerId })
    .eq("id", input.proposalId)
    .eq("workspace_id", input.workspaceId);

  await supabase
    .from("jobs")
    .update({ customer_id: input.customerId })
    .eq("proposal_id", input.proposalId)
    .eq("workspace_id", input.workspaceId);

  if (input.jobId) {
    await supabase
      .from("jobs")
      .update({ customer_id: input.customerId })
      .eq("id", input.jobId)
      .eq("workspace_id", input.workspaceId);
  }

  await supabase
    .from("visits")
    .update({ customer_id: input.customerId })
    .eq("linked_proposal_id", input.proposalId)
    .eq("workspace_id", input.workspaceId);

  await supabase
    .from("enquiries")
    .update({ customer_id: input.customerId })
    .eq("linked_proposal_id", input.proposalId)
    .eq("workspace_id", input.workspaceId);

  const { data: unlinkedVisits } = await supabase
    .from("visits")
    .select("id, contact_email, contact_phone")
    .eq("workspace_id", input.workspaceId)
    .is("customer_id", null);

  const visitIds = (unlinkedVisits ?? [])
    .filter(
      (visit) =>
        emailsMatch(visit.contact_email, input.email) ||
        phonesMatch(visit.contact_phone, input.phone)
    )
    .map((visit) => visit.id);

  if (visitIds.length > 0) {
    await supabase
      .from("visits")
      .update({ customer_id: input.customerId })
      .in("id", visitIds)
      .eq("workspace_id", input.workspaceId);
  }

  const { data: unlinkedEnquiries } = await supabase
    .from("enquiries")
    .select("id, customer_email, customer_mobile")
    .eq("workspace_id", input.workspaceId)
    .is("customer_id", null);

  const enquiryIds = (unlinkedEnquiries ?? [])
    .filter(
      (enquiry) =>
        emailsMatch(enquiry.customer_email, input.email) ||
        phonesMatch(enquiry.customer_mobile, input.phone)
    )
    .map((enquiry) => enquiry.id);

  if (enquiryIds.length > 0) {
    await supabase
      .from("enquiries")
      .update({ customer_id: input.customerId })
      .in("id", enquiryIds)
      .eq("workspace_id", input.workspaceId);
  }
}

export async function ensureActiveCustomerForAcceptedWork(
  supabase: SupabaseClient,
  input: EnsureActiveCustomerInput
): Promise<EnsureActiveCustomerResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const [candidates, enquiry, visits] = await Promise.all([
    loadWorkspaceCustomers(supabase, input.workspaceId),
    loadLinkedEnquiry(supabase, input.proposalId),
    loadLinkedVisits(
      supabase,
      input.workspaceId,
      input.proposalId,
      input.existingCustomerId
    ),
  ]);

  const linkedCustomer = candidates.find(
    (candidate) => candidate.id === input.existingCustomerId
  );
  const visit = visits[0];
  const source = mergeCustomerContactSources([
    linkedCustomer
      ? {
          name: linkedCustomer.name,
          email: linkedCustomer.email,
          phone: linkedCustomer.phone,
          address: linkedCustomer.address_line_1,
        }
      : null,
    input.source,
    enquiry
      ? {
          name: enquiry.customer_name,
          email: enquiry.customer_email,
          phone: enquiry.customer_mobile,
          address: formatAddress([
            enquiry.address_line_1,
            enquiry.address_line_2,
            enquiry.town,
            enquiry.county,
            enquiry.postcode,
          ]),
        }
      : null,
    visit
      ? {
          name: visit.customer_name,
          email: visit.contact_email,
          phone: visit.contact_phone,
          address: formatAddress([
            visit.address_line_1,
            visit.address_line_2,
            visit.town,
            visit.county,
            visit.postcode,
          ]),
        }
      : null,
  ]);

  const plan = planEnsureActiveCustomer({
    workspaceId: input.workspaceId,
    existingCustomerId: input.existingCustomerId,
    source,
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
    if (
      existing &&
      shouldPreserveCustomerLifecycle({
        archivedAt: existing.archived_at,
        deletionRequestedAt: existing.deletion_requested_at,
        anonymisedAt: existing.anonymised_at,
      })
    ) {
      await linkCustomerRecords(supabase, {
        workspaceId: input.workspaceId,
        proposalId: input.proposalId,
        jobId: input.jobId,
        customerId,
        email: existing.email,
        phone: existing.phone,
      });
      return { ok: true, skipped: false, customerId, created: false };
    }

    const { error: updateError } = await supabase
      .from("customers")
      .update({
        activated_at: existing?.activated_at ?? nowIso,
        name: plan.activatePatch.name || existing?.name || "Customer",
        email: existing?.email || plan.activatePatch.email || null,
        phone: existing?.phone || plan.activatePatch.phone || null,
        address_line_1:
          existing?.address_line_1 || plan.activatePatch.address_line_1 || null,
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
    email: source.email,
    phone: source.phone,
  });

  return { ok: true, skipped: false, customerId, created };
}
