"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import { createCustomerAccessToken } from "@/lib/proposals/customer-portal/create-customer-access-token";
import {
  buildVisitSlotLabel,
  resolveVisitStartsAt,
} from "@/lib/visits/customer-confirmation/starts-at";
import {
  CUSTOMER_NOT_AUTO_NOTIFIED_NOTICE,
  cancelBlockedReason,
  rescheduleBlockedReason,
} from "@/lib/visits/lifecycle";
import { linkCaptureSessionToVisit } from "@/lib/visits/link-capture-session";
import { notifyCustomerOfVisit } from "@/lib/visits/notify";
import { getVisit } from "@/lib/visits/queries";
import {
  afterVisitCreatedRedirect,
  isNewVisitType,
  planVisitSaveCustomerLink,
} from "@/lib/visits/new-visit";
import {
  isVisitStatus,
  type VisitStatus,
  type VisitType,
} from "@/lib/visits/types";

export type VisitActionState = {
  error?: string;
  ok?: boolean;
  notice?: string;
};

export type OrganiseVisitNotesState = {
  error?: string;
  organised?: import("@/lib/visits/organise-visit-notes").VisitNotesOrganised;
  /** Notes text that produced the organised summary — used to hide stale results. */
  notesSnapshot?: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function getNumber(formData: FormData, key: string, fallback: number): number {
  const raw = getString(formData, key);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function revalidateVisitPaths(
  visitId?: string,
  customerId?: string | null,
  enquiryId?: string | null,
  proposalId?: string | null,
  confirmationToken?: string | null
) {
  revalidatePath("/visits");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/enquiries");
  if (visitId) {
    revalidatePath(`/visits/${visitId}`);
  }
  if (customerId) {
    revalidatePath(`/customers/${customerId}`);
  }
  if (enquiryId) {
    revalidatePath(`/enquiries/${enquiryId}`);
  }
  if (proposalId) {
    revalidatePath(`/proposals/${proposalId}`);
  }
  const token = confirmationToken?.trim();
  if (token) {
    revalidatePath(`/v/${token}`);
  }
}

export async function createVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const customerId = getString(formData, "customerId") || null;
  const enquiryId = getString(formData, "enquiryId") || null;
  const proposalId = getString(formData, "proposalId") || null;
  const customerName = getString(formData, "customerName");
  const contactPhone = getString(formData, "contactPhone");
  const contactEmail = getString(formData, "contactEmail");
  const addressLine1 = getString(formData, "addressLine1");
  const addressLine2 = getString(formData, "addressLine2");
  const town = getString(formData, "town");
  const county = getString(formData, "county");
  const postcode = getString(formData, "postcode");
  const enquirySummary = getString(formData, "enquirySummary");
  const visitType = getString(formData, "visitType");
  const visitDate = getString(formData, "visitDate");
  const visitTime = getString(formData, "visitTime");
  const durationMinutes = getNumber(formData, "durationMinutes", 60);
  const notifyCustomer = getString(formData, "notifyCustomer") === "1";

  if (!customerName) {
    return { error: "Choose or enter a customer name." };
  }
  if (!isNewVisitType(visitType)) {
    return { error: "Choose a visit type." };
  }
  if (!isIsoDate(visitDate)) {
    return { error: "Choose a visit date." };
  }
  if (visitTime && !isTime(visitTime)) {
    return { error: "Choose a valid start time." };
  }

  let resolvedCustomerId = planVisitSaveCustomerLink({
    selectedCustomerId: customerId,
  }).customerId;
  let resolvedEnquiryId = enquiryId;
  let resolvedProposalId = proposalId;

  if (enquiryId) {
    const { data: enquiry, error: enquiryError } = await context.supabase
      .from("enquiries")
      .select("id, customer_id, status")
      .eq("id", enquiryId)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();

    if (enquiryError || !enquiry) {
      return { error: "Could not find the linked enquiry." };
    }

    resolvedEnquiryId = enquiry.id;
    if (!resolvedCustomerId && enquiry.customer_id) {
      resolvedCustomerId = enquiry.customer_id as string;
    }
  }

  if (proposalId) {
    const { data: proposal, error: proposalError } = await context.supabase
      .from("proposals")
      .select("id, customer_id")
      .eq("id", proposalId)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();

    if (proposalError || !proposal) {
      return { error: "Could not find the linked job." };
    }

    resolvedProposalId = proposal.id;
    if (!resolvedCustomerId && proposal.customer_id) {
      resolvedCustomerId = proposal.customer_id as string;
    }
  }

  const startsAtResolved = resolveVisitStartsAt(visitDate, visitTime || null);
  if (!startsAtResolved.ok) {
    return { error: startsAtResolved.error };
  }
  const startsAt = startsAtResolved.startsAt;
  const slotLabel = buildVisitSlotLabel(visitDate, visitTime || null);

  let created: { id: string } | null = null;
  let error: { message?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = createCustomerAccessToken();
    const insertResult = await context.supabase
      .from("visits")
      .insert({
        workspace_id: context.workspaceId,
        customer_id: resolvedCustomerId,
        enquiry_id: resolvedEnquiryId || null,
        linked_proposal_id: resolvedProposalId || null,
        customer_name: customerName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        address_line_1: addressLine1,
        address_line_2: addressLine2,
        town,
        county,
        postcode,
        enquiry_summary: enquirySummary,
        visit_type: visitType as VisitType,
        visit_date: visitDate,
        visit_time: visitTime || null,
        duration_minutes: durationMinutes,
        status: "scheduled",
        notes: "",
        customer_access_token: token,
        starts_at: startsAt,
        slot_label: slotLabel,
      })
      .select("id")
      .single();

    if (!insertResult.error && insertResult.data) {
      created = insertResult.data;
      error = null;
      break;
    }

    error = insertResult.error;
    const message = insertResult.error?.message?.toLowerCase() ?? "";
    const isTokenCollision =
      message.includes("customer_access_token") ||
      message.includes("visits_customer_access_token");
    const isActiveInitialCollision =
      message.includes("visits_one_active_initial_per_enquiry") ||
      (message.includes("enquiry_id") && visitType === "initial_assessment");

    if (isActiveInitialCollision) {
      return {
        error:
          "An active initial visit is already booked for this enquiry. Open the existing visit or cancel it before booking another.",
      };
    }

    if (!isTokenCollision) {
      break;
    }
  }

  if (error || !created) {
    return { error: error?.message || "Could not create this visit." };
  }

  if (resolvedEnquiryId) {
    // Capture must succeed before the booking is treated as complete.
    const linked = await linkCaptureSessionToVisit(context.supabase, {
      workspaceId: context.workspaceId,
      visitId: created.id,
      enquiryId: resolvedEnquiryId,
      slotLabel,
      startsAt,
      visitDate,
    });

    if (!linked.ok) {
      // Roll back this empty booking only — never touch other visits/captures.
      await context.supabase
        .from("visits")
        .delete()
        .eq("id", created.id)
        .eq("workspace_id", context.workspaceId)
        .is("source_site_visit_id", null);

      return {
        error:
          linked.error ||
          "Could not create a separate capture session for this visit. The visit was not booked.",
      };
    }

    const timeLabel = visitTime || "time TBC";
    const confirmationLine = `${visitDate} at ${timeLabel}`;

    await context.supabase
      .from("enquiries")
      .update({
        status: "site_visit_booked",
        suggested_next_action:
          "Open Site Visit Mode when you arrive on site, then create a quote.",
      })
      .eq("id", resolvedEnquiryId)
      .eq("workspace_id", context.workspaceId)
      .in("status", ["new", "reviewing", "site_visit_booked"]);

    await context.supabase.from("enquiry_timeline_events").insert({
      workspace_id: context.workspaceId,
      enquiry_id: resolvedEnquiryId,
      label: `Site visit booked for ${confirmationLine}.`,
      event_type: "site_visit_booked",
      occurred_at: new Date().toISOString(),
      created_by: context.user.id,
    });
  }

  const visit = await getVisit(context.supabase, context.workspaceId, created.id);
  if (visit && notifyCustomer && visit.contact_email) {
    await notifyCustomerOfVisit({
      visit,
      businessName: context.workspace.business_name,
      replyTo: context.workspace.contact_email,
    });
  }

  revalidateVisitPaths(
    created.id,
    resolvedCustomerId,
    resolvedEnquiryId,
    resolvedProposalId
  );
  redirect(
    afterVisitCreatedRedirect({
      visitType,
      proposalId: resolvedProposalId,
      enquiryId: resolvedEnquiryId,
      customerId: resolvedCustomerId,
      visitId: created.id,
    })
  );
}

export async function startQuoteFromVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const visitId = getString(formData, "visitId");
  const notes = getString(formData, "notes");
  if (!visitId) {
    return { error: "Visit not found." };
  }

  const existing = await getVisit(context.supabase, context.workspaceId, visitId);
  if (!existing) {
    return { error: "Visit not found." };
  }

  const siteNotes = notes || existing.notes;
  if (!siteNotes.trim() && !existing.enquiry_summary.trim()) {
    return {
      error: "Add visit notes before creating a quote.",
    };
  }

  const { error } = await context.supabase
    .from("visits")
    .update({ notes: siteNotes })
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId);

  if (error) {
    return { error: error.message || "Could not save notes." };
  }

  revalidateVisitPaths(visitId, existing.customer_id, existing.enquiry_id);
  const quoteParams = new URLSearchParams();
  quoteParams.set("visitId", visitId);
  if (existing.enquiry_id) {
    quoteParams.set("enquiryId", existing.enquiry_id);
  }
  redirect(`/proposals/new?${quoteParams.toString()}`);
}

export async function completeVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const visitId = getString(formData, "visitId");
  const notes = getString(formData, "notes");
  if (!visitId) {
    return { error: "Visit not found." };
  }

  const existing = await getVisit(context.supabase, context.workspaceId, visitId);
  if (!existing) {
    return { error: "Visit not found." };
  }

  if (existing.status === "cancelled" || existing.status === "no_show") {
    return { error: "Cancelled or no-show visits cannot be completed." };
  }
  if (existing.status === "completed") {
    return { ok: true };
  }

  const patch: { status: VisitStatus; notes?: string } = {
    status: "completed",
  };
  if (notes) {
    patch.notes = notes;
  }

  const { error } = await context.supabase
    .from("visits")
    .update(patch)
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId);

  if (error) {
    return { error: error.message || "Could not complete this visit." };
  }

  revalidateVisitPaths(
    visitId,
    existing.customer_id,
    existing.enquiry_id,
    existing.linked_proposal_id,
    existing.customer_access_token
  );
  return { ok: true };
}

export async function rescheduleVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const visitId = getString(formData, "visitId");
  const visitDate = getString(formData, "visitDate");
  const visitTime = getString(formData, "visitTime");
  if (!visitId) {
    return { error: "Visit not found." };
  }
  if (!isIsoDate(visitDate)) {
    return { error: "Choose a visit date." };
  }
  if (visitTime && !isTime(visitTime)) {
    return { error: "Choose a valid start time." };
  }

  const existing = await getVisit(context.supabase, context.workspaceId, visitId);
  if (!existing) {
    return { error: "Visit not found." };
  }

  const blocked = rescheduleBlockedReason(existing.status);
  if (blocked) {
    return { error: blocked };
  }

  const startsAtResolved = resolveVisitStartsAt(visitDate, visitTime || null);
  if (!startsAtResolved.ok) {
    return { error: startsAtResolved.error };
  }
  const startsAt = startsAtResolved.startsAt;
  const slotLabel = buildVisitSlotLabel(visitDate, visitTime || null);
  const previousToken = existing.customer_access_token;

  const { data: updated, error } = await context.supabase
    .from("visits")
    .update({
      visit_date: visitDate,
      visit_time: visitTime || null,
      starts_at: startsAt,
      slot_label: slotLabel,
    })
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId)
    .select("id, customer_access_token")
    .single();

  if (error || !updated) {
    return { error: error?.message || "Could not reschedule this visit." };
  }

  // Keep linked capture schedule fields in sync — never touch notes/photos.
  if (existing.source_site_visit_id) {
    await context.supabase
      .from("site_visits")
      .update({
        date_iso: visitDate,
        starts_at: startsAt,
        slot_label: slotLabel,
      })
      .eq("id", existing.source_site_visit_id)
      .eq("workspace_id", context.workspaceId)
      .eq("visit_id", visitId);
  } else if (existing.enquiry_id) {
    await context.supabase
      .from("site_visits")
      .update({
        date_iso: visitDate,
        starts_at: startsAt,
        slot_label: slotLabel,
      })
      .eq("enquiry_id", existing.enquiry_id)
      .eq("workspace_id", context.workspaceId)
      .eq("visit_id", visitId);
  }

  // Token must remain stable for the customer confirmation URL.
  if (
    previousToken &&
    updated.customer_access_token &&
    updated.customer_access_token !== previousToken
  ) {
    await context.supabase
      .from("visits")
      .update({ customer_access_token: previousToken })
      .eq("id", visitId)
      .eq("workspace_id", context.workspaceId);
  }

  revalidateVisitPaths(
    visitId,
    existing.customer_id,
    existing.enquiry_id,
    existing.linked_proposal_id,
    previousToken
  );

  return {
    ok: true,
    notice: CUSTOMER_NOT_AUTO_NOTIFIED_NOTICE,
  };
}

export async function cancelVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const visitId = getString(formData, "visitId");
  const confirmed = getString(formData, "confirmCancel") === "1";
  if (!visitId) {
    return { error: "Visit not found." };
  }
  if (!confirmed) {
    return { error: "Confirm cancellation before continuing." };
  }

  const existing = await getVisit(context.supabase, context.workspaceId, visitId);
  if (!existing) {
    return { error: "Visit not found." };
  }

  const blocked = cancelBlockedReason(existing.status);
  if (blocked) {
    return { error: blocked };
  }

  const { error } = await context.supabase
    .from("visits")
    .update({ status: "cancelled" satisfies VisitStatus })
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId);

  if (error) {
    return { error: error.message || "Could not cancel this visit." };
  }

  // Capture rows stay; photos/notes untouched. Confirmation token stays valid.

  revalidateVisitPaths(
    visitId,
    existing.customer_id,
    existing.enquiry_id,
    existing.linked_proposal_id,
    existing.customer_access_token
  );

  return {
    ok: true,
    notice: CUSTOMER_NOT_AUTO_NOTIFIED_NOTICE,
  };
}

export async function updateVisitNotesAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const visitId = getString(formData, "visitId");
  const notes = getString(formData, "notes");
  if (!visitId) {
    return { error: "Visit not found." };
  }

  const existing = await getVisit(context.supabase, context.workspaceId, visitId);
  if (!existing) {
    return { error: "Visit not found." };
  }

  const { error } = await context.supabase
    .from("visits")
    .update({ notes })
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId);

  if (error) {
    return { error: error.message || "Could not save notes." };
  }

  revalidateVisitPaths(visitId, existing.customer_id);
  return { ok: true };
}

export async function organiseVisitNotesAction(
  _prev: OrganiseVisitNotesState,
  formData: FormData
): Promise<OrganiseVisitNotesState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const visitId = getString(formData, "visitId");
  const notes = getString(formData, "notes");
  if (!visitId) {
    return { error: "Visit not found." };
  }
  if (!notes) {
    return { error: "Write what you found during the visit first." };
  }

  const existing = await getVisit(context.supabase, context.workspaceId, visitId);
  if (!existing) {
    return { error: "Visit not found." };
  }

  const { error: saveError } = await context.supabase
    .from("visits")
    .update({ notes })
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId);

  if (saveError) {
    return { error: saveError.message || "Could not save notes." };
  }

  try {
    const { organiseVisitNotesWithAi } = await import(
      "@/lib/visits/organise-visit-notes-ai"
    );
    const organised = await organiseVisitNotesWithAi(notes);
  revalidateVisitPaths(visitId, existing.customer_id, existing.enquiry_id);
  return { organised, notesSnapshot: notes };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not organise notes. Please try again.";
    return { error: message };
  }
}

export async function updateVisitStatusAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { error: context.error };
  }

  const visitId = getString(formData, "visitId");
  const status = getString(formData, "status");
  if (!visitId) {
    return { error: "Visit not found." };
  }
  if (!isVisitStatus(status)) {
    return { error: "Choose a valid status." };
  }

  const existing = await getVisit(context.supabase, context.workspaceId, visitId);
  if (!existing) {
    return { error: "Visit not found." };
  }

  // Do not silently reopen cancelled / completed / no-show visits via generic status updates.
  if (
    (existing.status === "cancelled" ||
      existing.status === "completed" ||
      existing.status === "no_show") &&
    status !== existing.status
  ) {
    return {
      error: `Cannot change a ${existing.status} visit with a generic status update.`,
    };
  }

  const { error } = await context.supabase
    .from("visits")
    .update({ status: status as VisitStatus })
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId);

  if (error) {
    return { error: error.message || "Could not update status." };
  }

  revalidateVisitPaths(
    visitId,
    existing.customer_id,
    existing.enquiry_id,
    existing.linked_proposal_id,
    existing.customer_access_token
  );
  return { ok: true };
}

export async function listVisitCalendarJobsAction(): Promise<
  | { ok: true; data: import("@/lib/calendar/calendar-data").CalendarJob[] }
  | { ok: false; error: string }
> {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { listCalendarVisits } = await import("@/lib/visits/queries");
  const { buildCalendarJobsFromVisits } = await import("@/lib/visits/calendar");
  const visits = await listCalendarVisits(context.supabase, context.workspaceId);
  return { ok: true, data: buildCalendarJobsFromVisits(visits) };
}
