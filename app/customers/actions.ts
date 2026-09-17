"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  anonymiseCustomerFields,
  archiveCustomerFields,
  canArchiveCustomer,
  canManageCustomerLifecycle,
  canPermanentlyDeleteCustomerNow,
  canRestoreCustomer,
  canScheduleCustomerDeletion,
  inspectRetentionRecords,
  readCustomerLifecycleState,
  restoreCustomerFields,
  scheduleCustomerDeletionFields,
  type RetentionRecordCounts,
} from "@/lib/customers/lifecycle";
import { userHasProfile } from "@/lib/onboarding/status";
import { formatPersonName } from "@/lib/text/format-name";

export type UpdateCustomerNotesState = {
  error?: string;
};

export type UpdateCustomerState = {
  error?: string;
};

export type CustomerLifecycleActionState = {
  error?: string;
};

export type CreateCustomerState = {
  error?: string;
};

type TraderCustomerContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  customer: {
    id: string;
    workspace_id: string;
    activated_at: string | null;
    archived_at: string | null;
    deletion_requested_at: string | null;
    deletion_scheduled_for: string | null;
    anonymised_at: string | null;
  };
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateCustomerViews(customerId: string) {
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/edit`);
}

function redirectAfterLifecycle(formData: FormData, customerId: string): never {
  if (getString(formData, "returnTo") === "list") {
    redirect("/customers");
  }
  redirect(`/customers/${customerId}`);
}

async function loadTraderCustomer(
  customerId: string
): Promise<
  | { ok: true; context: TraderCustomerContext }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", ok: false };
  }

  if (!(await userHasProfile(user.id))) {
    return {
      error: "Please complete onboarding before managing customers.",
      ok: false,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.workspace_id) {
    return { error: "Could not find your workspace.", ok: false };
  }

  if (!customerId) {
    return { error: "Customer not found.", ok: false };
  }

  const { data: customer, error: loadError } = await supabase
    .from("customers")
    .select(
      "id, workspace_id, activated_at, archived_at, deletion_requested_at, deletion_scheduled_for, anonymised_at"
    )
    .eq("id", customerId)
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle();

  if (loadError || !customer) {
    return { error: "Customer not found.", ok: false };
  }

  const allowed = canManageCustomerLifecycle({
    isAuthenticated: true,
    isTrader: true,
    isPortalUser: false,
    actorWorkspaceId: profile.workspace_id,
    customerWorkspaceId: customer.workspace_id,
  });

  if (!allowed.ok) {
    return { error: "You cannot change this customer.", ok: false };
  }

  return {
    ok: true,
    context: {
      supabase,
      workspaceId: profile.workspace_id,
      customer,
    },
  };
}

async function countRows(
  supabase: TraderCustomerContext["supabase"],
  table: string,
  workspaceId: string,
  customerId: string
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("customer_id", customerId);

  return count ?? 0;
}

async function loadRetentionCounts(
  supabase: TraderCustomerContext["supabase"],
  workspaceId: string,
  customerId: string
): Promise<RetentionRecordCounts> {
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, accepted_at, status")
    .eq("workspace_id", workspaceId)
    .eq("customer_id", customerId);

  const proposalIds = (proposals ?? []).map((row) => row.id as string);
  const acceptedProposals = (proposals ?? []).filter(
    (row) =>
      Boolean(row.accepted_at) ||
      row.status === "booked" ||
      row.status === "completed"
  ).length;

  const jobs = await countRows(supabase, "jobs", workspaceId, customerId);
  const visits = await countRows(supabase, "visits", workspaceId, customerId);

  let timelineEvents = 0;
  let conversations = 0;
  if (proposalIds.length > 0) {
    const { count: eventCount } = await supabase
      .from("proposal_status_events")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("proposal_id", proposalIds);
    const { count: messageCount } = await supabase
      .from("proposal_customer_messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("proposal_id", proposalIds);
    timelineEvents = eventCount ?? 0;
    conversations = messageCount ?? 0;
  }

  return {
    acceptedProposals,
    jobs,
    invoices: 0,
    payments: 0,
    timelineEvents,
    conversations,
    visits,
  };
}

export async function createCustomer(
  _prevState: CreateCustomerState,
  formData: FormData
): Promise<CreateCustomerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to add customers." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding before adding customers." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.workspace_id) {
    return { error: "Could not find your workspace. Please try again." };
  }

  const name = formatPersonName(getString(formData, "name"));
  if (!name) {
    return { error: "Customer name is required." };
  }

  const nowIso = new Date().toISOString();
  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      workspace_id: profile.workspace_id,
      name,
      email: getString(formData, "email") || null,
      phone: getString(formData, "phone") || null,
      address_line_1: getString(formData, "address") || null,
      notes: getString(formData, "notes") || null,
      activated_at: nowIso,
    })
    .select("id")
    .single();

  if (error || !customer) {
    return { error: error?.message ?? "Could not add this customer." };
  }

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(
  _prevState: UpdateCustomerState,
  formData: FormData
): Promise<UpdateCustomerState> {
  const loaded = await loadTraderCustomer(getString(formData, "customerId"));
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (loaded.context.customer.anonymised_at) {
    return { error: "This customer has been removed and cannot be edited." };
  }

  const name = formatPersonName(getString(formData, "name"));
  if (!name) {
    return { error: "Customer name is required." };
  }

  const { error: updateError } = await loaded.context.supabase
    .from("customers")
    .update({
      name,
      email: getString(formData, "email") || null,
      phone: getString(formData, "phone") || null,
      address_line_1: getString(formData, "address") || null,
      address_line_2: null,
      town: null,
      county: null,
      postcode: null,
      notes: getString(formData, "notes") || null,
    })
    .eq("id", loaded.context.customer.id)
    .eq("workspace_id", loaded.context.workspaceId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not save customer details.",
    };
  }

  revalidateCustomerViews(loaded.context.customer.id);
  redirect(`/customers/${loaded.context.customer.id}`);
}

export async function updateCustomerNotes(
  _prevState: UpdateCustomerNotesState,
  formData: FormData
): Promise<UpdateCustomerNotesState> {
  const loaded = await loadTraderCustomer(getString(formData, "customerId"));
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  if (loaded.context.customer.anonymised_at) {
    return { error: "This customer has been removed and cannot be edited." };
  }

  const { error: updateError } = await loaded.context.supabase
    .from("customers")
    .update({ notes: getString(formData, "notes") || null })
    .eq("id", loaded.context.customer.id)
    .eq("workspace_id", loaded.context.workspaceId);

  if (updateError) {
    return {
      error: updateError.message ?? "Could not save customer notes.",
    };
  }

  revalidateCustomerViews(loaded.context.customer.id);
  redirect(`/customers/${loaded.context.customer.id}`);
}

export async function archiveCustomer(
  _prevState: CustomerLifecycleActionState,
  formData: FormData
): Promise<CustomerLifecycleActionState> {
  const loaded = await loadTraderCustomer(getString(formData, "customerId"));
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const state = readCustomerLifecycleState(loaded.context.customer);
  if (!canArchiveCustomer(state)) {
    return { error: "Only an active customer can be archived." };
  }

  const { error } = await loaded.context.supabase
    .from("customers")
    .update(archiveCustomerFields(new Date().toISOString()))
    .eq("id", loaded.context.customer.id)
    .eq("workspace_id", loaded.context.workspaceId);

  if (error) {
    return { error: error.message ?? "Could not archive this customer." };
  }

  revalidateCustomerViews(loaded.context.customer.id);
  redirectAfterLifecycle(formData, loaded.context.customer.id);
}

export async function restoreCustomer(
  _prevState: CustomerLifecycleActionState,
  formData: FormData
): Promise<CustomerLifecycleActionState> {
  const loaded = await loadTraderCustomer(getString(formData, "customerId"));
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const state = readCustomerLifecycleState(loaded.context.customer);
  if (!canRestoreCustomer(state)) {
    return { error: "This customer cannot be restored." };
  }

  const { error } = await loaded.context.supabase
    .from("customers")
    .update({
      ...restoreCustomerFields(),
      activated_at: loaded.context.customer.activated_at ?? new Date().toISOString(),
    })
    .eq("id", loaded.context.customer.id)
    .eq("workspace_id", loaded.context.workspaceId);

  if (error) {
    return { error: error.message ?? "Could not restore this customer." };
  }

  revalidateCustomerViews(loaded.context.customer.id);
  redirectAfterLifecycle(formData, loaded.context.customer.id);
}

export async function requestCustomerDeletion(
  _prevState: CustomerLifecycleActionState,
  formData: FormData
): Promise<CustomerLifecycleActionState> {
  const loaded = await loadTraderCustomer(getString(formData, "customerId"));
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const state = readCustomerLifecycleState(loaded.context.customer);
  if (!canScheduleCustomerDeletion(state)) {
    return { error: "This customer cannot be scheduled for deletion." };
  }

  const { error } = await loaded.context.supabase
    .from("customers")
    .update(scheduleCustomerDeletionFields(new Date().toISOString()))
    .eq("id", loaded.context.customer.id)
    .eq("workspace_id", loaded.context.workspaceId);

  if (error) {
    return { error: error.message ?? "Could not schedule this deletion." };
  }

  revalidateCustomerViews(loaded.context.customer.id);
  redirectAfterLifecycle(formData, loaded.context.customer.id);
}

export async function permanentlyDeleteCustomer(
  _prevState: CustomerLifecycleActionState,
  formData: FormData
): Promise<CustomerLifecycleActionState> {
  const loaded = await loadTraderCustomer(getString(formData, "customerId"));
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const state = readCustomerLifecycleState(loaded.context.customer);
  if (!canPermanentlyDeleteCustomerNow(state)) {
    return {
      error: "Permanent deletion is only available during the 30-day window.",
    };
  }

  const counts = await loadRetentionCounts(
    loaded.context.supabase,
    loaded.context.workspaceId,
    loaded.context.customer.id
  );
  const plan = inspectRetentionRecords(counts);
  const nowIso = new Date().toISOString();

  if (plan.mustRetain) {
    const { error } = await loaded.context.supabase
      .from("customers")
      .update(anonymiseCustomerFields(nowIso))
      .eq("id", loaded.context.customer.id)
      .eq("workspace_id", loaded.context.workspaceId);

    if (error) {
      return { error: error.message ?? "Could not remove this customer." };
    }

    await loaded.context.supabase
      .from("proposals")
      .update({
        customer_email: null,
        customer_phone: null,
        customer_name: "Former customer",
        customer_address: null,
      })
      .eq("customer_id", loaded.context.customer.id)
      .eq("workspace_id", loaded.context.workspaceId);

    await loaded.context.supabase
      .from("visits")
      .update({
        customer_name: "Former customer",
        contact_email: null,
        contact_phone: null,
      })
      .eq("customer_id", loaded.context.customer.id)
      .eq("workspace_id", loaded.context.workspaceId);
  } else {
    const { error } = await loaded.context.supabase
      .from("customers")
      .delete()
      .eq("id", loaded.context.customer.id)
      .eq("workspace_id", loaded.context.workspaceId);

    if (error) {
      return { error: error.message ?? "Could not delete this customer." };
    }
  }

  revalidatePath("/customers");
  redirect("/customers");
}
