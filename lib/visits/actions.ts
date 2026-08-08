"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import { notifyCustomerOfVisit } from "@/lib/visits/notify";
import { getVisit } from "@/lib/visits/queries";
import {
  isVisitStatus,
  isVisitType,
  type VisitStatus,
  type VisitType,
} from "@/lib/visits/types";

export type VisitActionState = {
  error?: string;
  ok?: boolean;
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

function revalidateVisitPaths(visitId?: string, customerId?: string | null) {
  revalidatePath("/visits");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  if (visitId) {
    revalidatePath(`/visits/${visitId}`);
  }
  if (customerId) {
    revalidatePath(`/customers/${customerId}`);
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
  if (!isVisitType(visitType)) {
    return { error: "Choose a visit type." };
  }
  if (!isIsoDate(visitDate)) {
    return { error: "Choose a visit date." };
  }
  if (visitTime && !isTime(visitTime)) {
    return { error: "Choose a valid start time." };
  }

  const { data: created, error } = await context.supabase
    .from("visits")
    .insert({
      workspace_id: context.workspaceId,
      customer_id: customerId,
      enquiry_id: enquiryId || null,
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
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message || "Could not create this visit." };
  }

  const visit = await getVisit(context.supabase, context.workspaceId, created.id);
  if (visit && notifyCustomer && visit.contact_email) {
    await notifyCustomerOfVisit({
      visit,
      businessName: context.workspace.business_name,
      replyTo: context.workspace.contact_email,
    });
  }

  revalidateVisitPaths(created.id, customerId);
  redirect(`/visits/${created.id}`);
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
    revalidateVisitPaths(visitId, existing.customer_id);
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

  const { error } = await context.supabase
    .from("visits")
    .update({ status: status as VisitStatus })
    .eq("id", visitId)
    .eq("workspace_id", context.workspaceId);

  if (error) {
    return { error: error.message || "Could not update status." };
  }

  revalidateVisitPaths(visitId, existing.customer_id);
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
